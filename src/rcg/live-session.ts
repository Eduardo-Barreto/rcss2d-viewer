import { frameBuffers } from './columns'
import { monitorLinesToRcg } from './monitor-file'
import { DEFAULT_LIMITS, RcgParser, type RcgLimits } from './parser'
import type { LiveCommand, LiveEnd, LiveReply } from './protocol'
import { RcgError } from './scanner'

/** The part of a WebSocket the session uses, so tests can hand it a fake. */
export type LiveSocket = Pick<WebSocket, 'addEventListener' | 'send' | 'close' | 'readyState'>

/** Sends a reply to the page, handing over the buffers listed in `transfer`. */
export type LiveEmit = (reply: LiveReply, transfer: Transferable[]) => void

/** How the session opens its socket and how often it sends a batch. */
export interface LiveSessionOptions {
  open: (url: string) => LiveSocket
  limits: RcgLimits
  flushMs: number
}

const FLUSH_MS = 100
const MIB = 1_048_576
const LIVE_MAX_BYTES_MIB = 128

/**
 * Limits for a live session. The lines are kept as JS strings for saving, so the byte cap is
 * lower than for a file: a full match with teams is about 22 MB of monitor text.
 */
export const LIVE_LIMITS: RcgLimits = { ...DEFAULT_LIMITS, maxBytes: LIVE_MAX_BYTES_MIB * MIB }

const DEFAULT_OPTIONS: LiveSessionOptions = {
  open: (url) => new WebSocket(url),
  limits: LIVE_LIMITS,
  flushMs: FLUSH_MS,
}

interface RelayStatus {
  server: 'up' | 'down'
  session: number
}

/** Reads a relay status line, `{"relay":"status","server":"up","session":1}`. */
function readStatus(line: string): RelayStatus | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  return statusOf(parsed)
}

function statusOf(parsed: unknown): RelayStatus | null {
  if (typeof parsed !== 'object' || parsed === null) return null
  if (!('relay' in parsed && 'server' in parsed && 'session' in parsed)) return null
  const { relay, server, session } = parsed
  if (relay !== 'status' || (server !== 'up' && server !== 'down')) return null
  return Number.isInteger(session) ? { server, session: Number(session) } : null
}

/**
 * One live connection, inside the worker: lines from the relay go through the same
 * {@link RcgParser} a file does, and every `flushMs` the new frames go to the page as one
 * {@link MatchDelta}, their buffers handed over rather than copied.
 */
export class LiveSession {
  private readonly parser: RcgParser
  private readonly socket: LiveSocket
  private readonly emit: LiveEmit
  private readonly limits: RcgLimits
  private readonly timer: ReturnType<typeof setInterval>
  private session: number | null = null
  private opened = false
  private ended = false
  /** Every line kept, for saving the match; a frame the parser folds into the last one replaces it. */
  private readonly raw: string[] = []
  private rawBytes = 0
  private rawFull = false
  private lastShow = -1

  constructor(url: string, emit: LiveEmit, options: Partial<LiveSessionOptions> = {}) {
    const { open, limits, flushMs } = { ...DEFAULT_OPTIONS, ...options }
    this.emit = emit
    this.limits = limits
    this.parser = new RcgParser(limits, 'monitor')
    this.socket = open(url)
    this.socket.addEventListener('open', () => {
      this.opened = true
    })
    this.socket.addEventListener('message', (event) => this.receive(event.data))
    this.socket.addEventListener('close', () => this.end(this.opened ? 'closed' : 'unreachable'))
    this.timer = setInterval(() => this.flush(), flushMs)
  }

  /** Passes a command on to the relay, which forwards it only when it is allowed. */
  command(command: LiveCommand): void {
    if (!this.ended && this.socket.readyState === WebSocket.OPEN) this.socket.send(command)
  }

  /** Closes the connection without reporting an end: the page asked for it. */
  stop(): void {
    this.ended = true
    clearInterval(this.timer)
    this.socket.close()
  }

  /** Sends what arrived since the last batch, if anything did. */
  flush(): void {
    const delta = this.parser.drain()
    if (delta !== null) this.emit({ kind: 'live-delta', delta }, frameBuffers(delta.frames))
  }

  /** True until the session ends; a method, so each loop turn reads it again. */
  private isActive(): boolean {
    return !this.ended
  }

  private receive(payload: unknown): void {
    if (typeof payload !== 'string') {
      this.end('invalid')
      return
    }
    for (const line of payload.split('\n')) {
      if (!this.isActive()) return
      if (line.startsWith('{')) this.status(line)
      else this.line(line)
    }
  }

  private status(line: string): void {
    const status = readStatus(line)
    if (status === null) {
      this.end('invalid')
      return
    }
    if (this.session !== status.session && this.parser.frameCount > 0) {
      this.end('restarted')
      return
    }
    this.session = status.session
    this.emit({ kind: 'live-open', server: status.server }, [])
  }

  /**
   * The match so far as a gzipped version 6 `.rcg`, or null when nothing arrived or the lines
   * outgrew the size limit and stopped being kept.
   */
  async save(): Promise<Blob | null> {
    if (this.rawFull || this.raw.length === 0) return null
    const text = new Blob([monitorLinesToRcg(this.raw)]).stream()
    return new Response(text.pipeThrough(new CompressionStream('gzip'))).blob()
  }

  private line(line: string): void {
    const frames = this.parser.frameCount
    const skipped = this.parser.skipped
    try {
      this.parser.pushLast(line)
    } catch (error) {
      if (!(error instanceof RcgError)) throw error
      this.end(this.parser.frameCount >= this.limits.maxFrames ? 'full' : 'invalid')
      return
    }
    const added = this.parser.frameCount > frames
    if (line !== '' && (added || this.parser.skipped === skipped)) this.record(line, added)
  }

  private record(line: string, added: boolean): void {
    if (this.rawFull) return
    const show = line.startsWith('(show ')
    if (show && !added && this.lastShow >= 0) {
      this.raw[this.lastShow] = line
      return
    }
    this.rawBytes += line.length
    if (this.rawBytes > this.limits.maxBytes) {
      this.rawFull = true
      this.raw.length = 0
      return
    }
    const at = this.raw.push(line) - 1
    if (show) this.lastShow = at
  }

  private end(reason: LiveEnd): void {
    if (this.ended) return
    this.flush()
    this.stop()
    this.emit({ kind: 'live-end', reason }, [])
  }
}
