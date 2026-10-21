import type { Server, ServerWebSocket, udp } from 'bun'

import type { RelayOptions } from './args.ts'
import { RateLimit, checkCommand, isAllowedOrigin } from './policy.ts'

/** One line of the relay's log, written as JSON. */
export type RelayLog = (event: Record<string, unknown>) => void

/** Timings, shortened by the tests. */
export interface RelayTiming {
  /** Wait before the second `(dispinit)`; it doubles after each one the server leaves unanswered. */
  retryMs: number
  /** Longest wait between two `(dispinit)`. */
  maxRetryMs: number
  /**
   * `(dispinit)` sent without an answer before the relay stops trying, until a page joins again.
   * With `max_monitors=-1` each one the server got but could not answer is a monitor it keeps
   * (`src/stadium.cpp:2790`), which is what happens when the answers cannot come back.
   */
  initAttempts: number
  /** Silence after which the server counts as down. Pages hear it; the session stays. */
  silenceMs: number
  /**
   * Silence after which the relay gives up on the server's dedicated port and sends
   * `(dispinit)` again. Kept well above `silenceMs`: a stalled server that comes back keeps
   * the old monitor, and a fresh `(dispinit)` would add a second one with a new session.
   */
  reconnectMs: number
}

/** A running relay. */
export interface Relay {
  /** The WebSocket port, useful when listening on port 0. */
  port: number
  stop: () => Promise<void>
}

/** Status the relay sends to pages, as JSON next to the server's lines. */
interface RelayStatus {
  relay: 'status'
  server: 'up' | 'down'
  /** Goes up by one each time the server starts a new monitor session. */
  session: number
}

/**
 * Monitor protocol 5, the newest text one: rcssserver 19 sends version 5 the same lines its
 * logger writes into a version 6 `.rcg` (`src/logger.cpp:166-170`, `src/dispsender.cpp:1137`).
 * Messages end in `\0`, which `Monitor::parseMsg` expects from version 2 on (`src/monitor.cpp:100`).
 */
const INIT = '(dispinit version 5)\0'
const BYE = '(dispbye)\0'
const TOPIC = 'live'
const DEFAULT_TIMING: RelayTiming = {
  retryMs: 1000,
  maxRetryMs: 16_000,
  initAttempts: 8,
  silenceMs: 3000,
  reconnectMs: 30_000,
}
const MAX_COMMAND_BYTES = 64
const BACKPRESSURE_BYTES = 4_194_304
const IDLE_SECONDS = 60
const COMMAND_BURST = 4
const COMMAND_REFILL_MS = 1000
const MAX_STRIKES = 20
const POLICY_VIOLATION = 1008
const TRY_AGAIN_LATER = 1013
/** Pages at once. Each one is a tab of the viewer; more than this is not a person watching. */
const MAX_CLIENTS = 16
const MAX_CACHED_GRAPHICS = 1024
/** `server_param`, `player_param` and the player types: 20 lines in rcssserver 19. */
const MAX_CACHED_PARAMS = 256
const BEFORE_KICK_OFF = 1
const DROP_LOG_EVERY = 1000
const SHOW_MODE = /^\(show \d+ \(pm (?<mode>\d+)\)/

interface Client {
  strikes: number
}

/** The datagram's text without the `\\0` the server ends every message with. */
export function strip(buffer: Buffer): string {
  let end = buffer.length
  while (end > 0 && buffer[end - 1] === 0) end--
  return buffer.toString('utf8', 0, end)
}

/** The UDP side: one monitor session shared by every page, and what a late page needs. */
class MonitorLink {
  session = 0
  up = false
  mode = -1
  private socket: udp.Socket<'buffer'> | null = null
  private opening: Promise<void> | null = null
  private wanted = false
  /** True once the server answered from its dedicated port; only that port is heard from then on. */
  private answered = false
  private attempts = 0
  private nextInit = 0
  private serverPort: number
  private lastData = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private params: string[] = []
  private graphics: string[] = []
  private lastShow: string | null = null

  private readonly options: RelayOptions
  private readonly timing: RelayTiming
  private readonly log: RelayLog
  private readonly onLine: (line: string) => void
  private readonly onStatus: () => void

  constructor(
    options: RelayOptions,
    timing: RelayTiming,
    log: RelayLog,
    sinks: { line: (line: string) => void; status: () => void },
  ) {
    this.options = options
    this.timing = timing
    this.log = log
    this.onLine = sinks.line
    this.onStatus = sinks.status
    this.serverPort = options.server.port
  }

  /** Lines a page that joins now needs before the next show: parameters, logos, last frame. */
  backlog(): string[] {
    return [...this.params, ...this.graphics, ...(this.lastShow === null ? [] : [this.lastShow])]
  }

  /** Joins the server as a monitor. Safe to call again while a first call is still opening. */
  async open(): Promise<void> {
    this.wanted = true
    this.attempts = 0
    this.nextInit = 0
    this.opening ??= this.bind()
    await this.opening
  }

  private async bind(): Promise<void> {
    if (this.socket !== null) return
    const socket = await Bun.udpSocket({
      hostname: localAddress(this.options.server.host),
      socket: {
        data: (_socket, buffer, port, address) => this.receive(buffer, port, address),
        error: () => this.setUp(false),
      },
    })
    this.opening = null
    if (!this.wanted) {
      socket.close()
      return
    }
    this.socket = socket
    this.serverPort = this.options.server.port
    this.answered = false
    this.attempts = 0
    this.nextInit = 0
    this.log({ event: 'monitor-open', local: `${socket.hostname}:${socket.port}` })
    this.tick()
    this.timer = setInterval(() => this.tick(), this.timing.retryMs)
  }

  /** Leaves the server with `(dispbye)` and closes the socket. */
  close(): void {
    this.wanted = false
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    if (this.socket === null) return
    if (this.answered) this.send(BYE, this.serverPort)
    this.socket.close()
    this.socket = null
    this.forget()
    this.setUp(false)
    this.log({ event: 'monitor-close' })
  }

  /** Sends a page's command to the port the server answers from (`src/remoteclient.cpp:193`). */
  command(text: string): void {
    this.send(`${text}\0`, this.serverPort)
  }

  private tick(): void {
    const silence = Date.now() - this.lastData
    if (this.up && silence > this.timing.silenceMs) {
      this.setUp(false)
      this.log({ event: 'server-lost' })
    }
    if (this.answered && silence > this.timing.reconnectMs) {
      this.send(BYE, this.serverPort)
      this.answered = false
      this.serverPort = this.options.server.port
      this.attempts = 0
      this.nextInit = 0
      this.log({ event: 'server-reinit' })
    }
    if (!this.answered) this.init()
  }

  /** Sends `(dispinit)` when its backoff is over, and gives up after `initAttempts`. */
  private init(): void {
    const now = Date.now()
    if (this.attempts >= this.timing.initAttempts || now < this.nextInit) return
    this.send(INIT, this.options.server.port)
    this.attempts++
    const wait = this.timing.retryMs * 2 ** (this.attempts - 1)
    this.nextInit = now + Math.min(wait, this.timing.maxRetryMs)
    if (this.attempts < this.timing.initAttempts) return
    this.log({
      event: 'server-gave-up',
      attempts: this.attempts,
      hint: 'no answer to (dispinit); with the server in Docker, run the relay on its network',
    })
  }

  /**
   * Sends one datagram. Bun returns true even when nothing listens there: the ECONNREFUSED
   * comes later, through the socket's `error` callback, which marks the server down.
   */
  private send(text: string, port: number): void {
    try {
      this.socket?.send(text, port, this.options.server.host)
    } catch {
      this.setUp(false)
    }
  }

  /**
   * Hears only the server. Before it answers, an `(error ...)` from the init port is logged and
   * the first `(server_param ...)`, which `Monitor::sendInit` sends before anything else from
   * the new dedicated port (`src/stadium.cpp:2819`, `src/monitor.cpp:181-185`), fixes that port.
   * From then on any other port is dropped, so another local process cannot add frames or take
   * the commands.
   */
  private receive(buffer: Buffer, port: number, address: string): void {
    if (address !== this.options.server.host && !address.endsWith(`:${this.options.server.host}`)) {
      this.dropped('address')
      return
    }
    const line = strip(buffer)
    if (!this.answered) {
      if (line.startsWith('(error') && port === this.options.server.port) {
        this.log({ event: 'server-error', message: line.slice(0, MAX_COMMAND_BYTES) })
        return
      }
      if (!line.startsWith('(server_param')) {
        this.dropped('before-answer')
        return
      }
      this.answered = true
      this.serverPort = port
    } else if (port !== this.serverPort) {
      this.dropped('port')
      return
    }
    this.lastData = Date.now()
    if (line.startsWith('(server_param')) this.startSession()
    this.setUp(true)
    this.remember(line)
    this.onLine(line)
  }

  private droppedCount = 0

  /** Counts a datagram that did not come from the server; logs the first and every 1000th. */
  private dropped(reason: string): void {
    this.droppedCount++
    if (this.droppedCount % DROP_LOG_EVERY === 1) {
      this.log({ event: 'udp-dropped', reason, count: this.droppedCount })
    }
  }

  /** Drops what a late page would get: it belongs to a session that is over. */
  private forget(): void {
    this.params = []
    this.graphics = []
    this.lastShow = null
    this.mode = -1
  }

  private startSession(): void {
    this.session++
    this.forget()
    this.log({ event: 'session', session: this.session })
    this.onStatus()
  }

  private remember(line: string): void {
    if (line.startsWith('(show ')) this.rememberShow(line)
    else if (line.startsWith('(msg ') && line.includes('team_graphic_')) {
      if (this.graphics.length < MAX_CACHED_GRAPHICS) this.graphics.push(line)
    } else if (line.startsWith('(server_param') || line.startsWith('(player_')) {
      if (this.params.length < MAX_CACHED_PARAMS) this.params.push(line)
    }
  }

  private rememberShow(line: string): void {
    this.lastShow = line
    const mode = Number(SHOW_MODE.exec(line)?.groups?.mode ?? Number.NaN)
    if (Number.isInteger(mode)) this.mode = mode
  }

  private setUp(up: boolean): void {
    if (this.up === up) return
    this.up = up
    this.log({ event: up ? 'server-up' : 'server-down', session: this.session })
    this.onStatus()
  }
}

/** Where the UDP socket binds: loopback when the server is on loopback, so nothing else hears it. */
function localAddress(serverHost: string): string {
  if (serverHost === '127.0.0.1' || serverHost === '::1') return serverHost
  return serverHost.includes(':') ? '::' : '0.0.0.0'
}

function statusLine(link: MonitorLink): string {
  const status: RelayStatus = {
    relay: 'status',
    server: link.up ? 'up' : 'down',
    session: link.session,
  }
  return JSON.stringify(status)
}

/**
 * Starts the relay: one monitor connection to rcssserver, fanned out to every page on the
 * WebSocket. It only passes text along. Pages may send `(dispstart)` and `(dispbye)`, and
 * nothing else; `(dispbye)` closes that page alone, and the monitor session ends when the
 * last page leaves.
 */
export async function startRelay(
  options: RelayOptions,
  log: RelayLog,
  timing: RelayTiming = DEFAULT_TIMING,
): Promise<Relay> {
  let publish: ((text: string) => void) | null = null
  const link = new MonitorLink(options, timing, log, {
    line: (line) => publish?.(line),
    status: () => publish?.(statusLine(link)),
  })
  const clients = new Set<ServerWebSocket<Client>>()
  /** One budget for every page, so opening another connection does not buy more commands. */
  const limit = new RateLimit(COMMAND_BURST, COMMAND_REFILL_MS, Date.now())

  const message = (ws: ServerWebSocket<Client>, raw: string | Buffer) => {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8')
    const refusal = checkCommand(text, link.mode === BEFORE_KICK_OFF, limit, Date.now())
    if (refusal === null && text === '(dispbye)') {
      ws.close()
      return
    }
    if (refusal === null) {
      link.command(text)
      if (text === '(dispstart)') link.mode = -1
      log({ event: 'command', command: text })
      return
    }
    ws.data.strikes++
    log({ event: 'command-dropped', reason: refusal, length: text.length })
    if (ws.data.strikes > MAX_STRIKES) ws.close(POLICY_VIOLATION, 'too many refused commands')
  }

  const server: Server<Client> = Bun.serve<Client>({
    hostname: options.listen.host,
    port: options.listen.port,
    fetch(request, bun) {
      const origin = request.headers.get('origin')
      if (!isAllowedOrigin(origin, options.allowNoOrigin)) {
        log({ event: 'origin-refused', origin: origin?.slice(0, MAX_COMMAND_BYTES) ?? null })
        return new Response('origin not allowed\n', { status: 403 })
      }
      const client: Client = { strikes: 0 }
      if (bun.upgrade(request, { data: client })) return undefined
      return new Response('this is a WebSocket relay for the rcss2d viewer\n', { status: 426 })
    },
    websocket: {
      maxPayloadLength: MAX_COMMAND_BYTES,
      backpressureLimit: BACKPRESSURE_BYTES,
      closeOnBackpressureLimit: true,
      idleTimeout: IDLE_SECONDS,
      perMessageDeflate: false,
      open(ws) {
        if (clients.size >= MAX_CLIENTS) {
          log({ event: 'client-refused', reason: 'full', clients: clients.size })
          ws.close(TRY_AGAIN_LATER, 'too many pages')
          return
        }
        clients.add(ws)
        ws.send(statusLine(link))
        for (const line of link.backlog()) ws.send(line)
        ws.subscribe(TOPIC)
        log({ event: 'client-open', clients: clients.size })
        void link.open()
      },
      message,
      close(ws) {
        if (!clients.delete(ws)) return
        log({ event: 'client-close', clients: clients.size })
        if (clients.size === 0) link.close()
      },
    },
  })
  publish = (text) => {
    server.publish(TOPIC, text)
  }
  const port = server.port ?? options.listen.port
  log({ event: 'listening', url: `ws://${options.listen.host}:${port}` })
  return {
    port,
    stop() {
      link.close()
      // Not awaited: in Bun 1.3.13 the promise never settles once the relay itself closed a
      // page's socket, though the port and every connection are closed right away.
      void server.stop(true)
      log({ event: 'stopped' })
      return Promise.resolve()
    },
  }
}
