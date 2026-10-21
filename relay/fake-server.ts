import type { udp } from 'bun'

import { strip } from './relay.ts'

/** What the fake server plays: the header lines, then one show per step. */
export interface FakeServerScript {
  /** `(server_param)`, `(player_param)` and `(player_type)` lines, sent on connect. */
  params: string[]
  /** Monitor lines with `(pm N) (tm ...)` in each show, as `asMonitorLines` makes them. */
  lines: string[]
  /** Time between two lines. */
  stepMs: number
  /** Repeat the first show with `(pm 1)` until a `(dispstart)`, like a server waiting. */
  waitForStart: boolean
  /** Init port; 0 picks a free one. */
  port?: number
}

/** A running fake server. */
export interface FakeServer {
  /** The init port, where `(dispinit)` goes. */
  port: number
  /** Every datagram the dedicated sockets got, `\0` stripped. */
  commands: string[]
  /** How many monitors are being sent to. */
  monitors: () => number
  /** Stops sending without dropping anyone, like a stalled or paused server, until released. */
  hold: (holding: boolean) => void
  stop: () => void
}

interface Monitor {
  socket: udp.Socket<'buffer'>
  port: number
  address: string
  next: number
  waiting: boolean
  timer: ReturnType<typeof setInterval>
}

const WAITING = /^\(show (?<cycle>\d+) \(pm \d+\)/

function waitingShow(line: string): string {
  return line.replace(WAITING, (_head, cycle: string) => `(show ${cycle} (pm 1)`)
}

/**
 * A stand-in for rcssserver's monitor port, for tests: answers `(dispinit version N)` from a
 * new socket, the way `Stadium::parseMonitorInit` hands each monitor a dedicated port
 * (rcssserver `src/stadium.cpp:2776`), sends the parameters and then one line per step.
 * `(dispstart)` ends the wait and `(dispbye)` stops that monitor (`src/monitor.cpp:339-410`).
 */
export async function startFakeServer(script: FakeServerScript): Promise<FakeServer> {
  const monitors = new Set<Monitor>()
  const commands: string[] = []
  let holding = false

  const step = (monitor: Monitor) => {
    if (holding) return
    const line = script.lines[monitor.next]
    if (line === undefined) return
    if (monitor.waiting) {
      monitor.socket.send(`${waitingShow(line)}\0`, monitor.port, monitor.address)
      return
    }
    monitor.socket.send(`${line}\0`, monitor.port, monitor.address)
    monitor.next++
  }

  const command = (monitor: Monitor, text: string) => {
    commands.push(text)
    if (text === '(dispstart)') monitor.waiting = false
    if (text === '(dispbye)') drop(monitor)
  }

  const drop = (monitor: Monitor) => {
    clearInterval(monitor.timer)
    monitor.socket.close()
    monitors.delete(monitor)
  }

  const open = async (port: number, address: string) => {
    let monitor: Monitor | null = null
    const socket = await Bun.udpSocket({
      hostname: '127.0.0.1',
      socket: {
        data: (_socket, buffer) => {
          if (monitor !== null) command(monitor, strip(buffer))
        },
        error: () => undefined,
      },
    })
    const opened: Monitor = {
      socket,
      port,
      address,
      next: 0,
      waiting: script.waitForStart,
      timer: setInterval(() => step(opened), script.stepMs),
    }
    monitor = opened
    monitors.add(opened)
    for (const line of script.params) socket.send(`${line}\0`, port, address)
  }

  const init = await Bun.udpSocket({
    hostname: '127.0.0.1',
    port: script.port ?? 0,
    socket: {
      data: (socket, buffer, port, address) => {
        if (strip(buffer).startsWith('(dispinit version ')) void open(port, address)
        else socket.send('(error only_init_allowed_on_init_port)\0', port, address)
      },
      error: () => undefined,
    },
  })

  return {
    port: init.port,
    commands,
    monitors: () => monitors.size,
    hold(next) {
      holding = next
    },
    stop() {
      for (const monitor of monitors) drop(monitor)
      init.close()
    },
  }
}
