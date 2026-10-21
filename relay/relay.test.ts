import { afterEach, describe, expect, test } from 'bun:test'

import type { udp } from 'bun'

import type { RelayOptions } from './args.ts'
import { type FakeServer, startFakeServer } from './fake-server.ts'
import { type Relay, type RelayLog, startRelay, strip } from './relay.ts'

const ORIGIN = 'http://localhost:5173'
const PARAMS = ['(server_param (half_time 300))', '(player_param (player_types 18))']
const SHOWS = Array.from({ length: 400 }, (_, cycle) => `(show ${cycle + 1} (pm 2) (tm a b 0 0))`)
const TIMING = {
  retryMs: 20,
  maxRetryMs: 80,
  initAttempts: 50,
  silenceMs: 200,
  reconnectMs: 600,
}
const WAIT_MS = 3000

let server: FakeServer | null = null
let relay: Relay | null = null
const sockets: WebSocket[] = []
const events: Record<string, unknown>[] = []
const log: RelayLog = (event) => {
  events.push(event)
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close()
  for (const peer of peers.splice(0)) peer.close()
  await relay?.stop()
  server?.stop()
  relay = null
  server = null
  events.length = 0
})

function optionsFor(serverPort: number): RelayOptions {
  return {
    server: { host: '127.0.0.1', port: serverPort },
    listen: { host: '127.0.0.1', port: 0 },
    allowRemote: false,
    allowNoOrigin: false,
  }
}

async function start(waitForStart = false): Promise<{ server: FakeServer; relay: Relay }> {
  server = await startFakeServer({ params: PARAMS, lines: SHOWS, stepMs: 10, waitForStart })
  relay = await startRelay(optionsFor(server.port), log, TIMING)
  return { server, relay }
}

/** A UDP socket on loopback that records what it gets, for playing the server or an intruder. */
async function udpPeer(): Promise<{ socket: udp.Socket<'buffer'>; got: string[] }> {
  const got: string[] = []
  const socket = await Bun.udpSocket({
    hostname: '127.0.0.1',
    socket: {
      data: (_socket, buffer) => {
        got.push(strip(buffer))
      },
      error: () => undefined,
    },
  })
  peers.push(socket)
  return { socket, got }
}

const peers: udp.Socket<'buffer'>[] = []

/** The relay's monitor socket port, from its `monitor-open` log line. */
async function relayUdpPort(): Promise<number> {
  await until(() => events.some((event) => event.event === 'monitor-open'))
  const local = events.find((event) => event.event === 'monitor-open')?.local
  return Number(String(local).split(':').at(-1))
}

function closed(tab: Tab): Promise<number> {
  return new Promise((resolve) =>
    tab.socket.addEventListener('close', (event) => resolve(event.code)),
  )
}

interface Tab {
  socket: WebSocket
  lines: string[]
}

function connect(port: number, origin = ORIGIN): Tab {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { Origin: origin } })
  const lines: string[] = []
  socket.addEventListener('message', (event) => {
    lines.push(String(event.data))
  })
  sockets.push(socket)
  return { socket, lines }
}

async function until(check: () => boolean): Promise<void> {
  const deadline = Date.now() + WAIT_MS
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting')
    await Bun.sleep(10)
  }
}

const shows = (tab: Tab) => tab.lines.filter((line) => line.startsWith('(show '))

describe('relay', () => {
  test('fans one monitor session out to every tab', async () => {
    const { server: fake, relay: running } = await start()
    const first = connect(running.port)
    await until(() => shows(first).length >= 5)
    const second = connect(running.port)
    await until(() => shows(second).length >= 5)

    expect(fake.monitors()).toBe(1)
    expect(first.lines[0]).toBe('{"relay":"status","server":"down","session":0}')
    expect(first.lines).toContain(PARAMS[0] ?? '')
    expect(second.lines).toContain(PARAMS[0] ?? '')
    const last = shows(second).at(-1)
    await until(() => shows(first).includes(last ?? ''))
    expect(shows(first).every((line) => !line.includes('\0'))).toBe(true)
  })

  test('refuses a page from another origin', async () => {
    const { relay: running } = await start()
    const refused = connect(running.port, 'https://evil.example')
    let failed = false
    refused.socket.addEventListener('error', () => {
      failed = true
    })
    await until(() => failed)
    expect(refused.lines).toEqual([])
    expect(events).toContainEqual({ event: 'origin-refused', origin: 'https://evil.example' })
  })

  test('drops every command but the allowed ones', async () => {
    const { server: fake, relay: running } = await start(true)
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 2)
    tab.socket.send('(dispfoul_left 0 0)')
    tab.socket.send('(dispstart) ')
    await until(() => events.filter((event) => event.event === 'command-dropped').length === 2)
    tab.socket.send('(dispstart)')
    await until(() => fake.commands.length === 1)
    await Bun.sleep(50)
    expect(fake.commands).toEqual(['(dispstart)'])
  })

  test('sends (dispstart) only while the server waits for the kick-off', async () => {
    const { server: fake, relay: running } = await start()
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 2)
    tab.socket.send('(dispstart)')
    await until(() => events.some((event) => event.reason === 'not-waiting'))
    expect(fake.commands).toEqual([])
  })

  test('passes one (dispstart) on when a page sends two before the next show', async () => {
    const { server: fake, relay: running } = await start(true)
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 2)
    tab.socket.send('(dispstart)')
    tab.socket.send('(dispstart)')
    await until(() => events.some((event) => event.reason === 'not-waiting'))
    expect(fake.commands).toEqual(['(dispstart)'])
  })

  test('binds the monitor socket to loopback when the server is on loopback', async () => {
    const { relay: running } = await start()
    connect(running.port)
    await until(() => events.some((event) => event.event === 'monitor-open'))
    expect(events.find((event) => event.event === 'monitor-open')?.local).toStartWith('127.0.0.1:')
  })

  test('leaves the server when the last tab goes', async () => {
    const { server: fake, relay: running } = await start()
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 2)
    tab.socket.close()
    await until(() => fake.commands.includes('(dispbye)'))
    expect(fake.monitors()).toBe(0)
  })

  test('gives a tab that comes after the last one left nothing of the old session', async () => {
    const { relay: running } = await start()
    const first = connect(running.port)
    await until(() => shows(first).length >= 20)
    first.socket.close()
    await until(() => events.some((event) => event.event === 'monitor-close'))
    const second = connect(running.port)
    await until(() => shows(second).length >= 1)
    expect(shows(second)[0]).toStartWith('(show 1 ')
  })

  test('joins the server once when tabs connect at the same time', async () => {
    const { server: fake, relay: running } = await start()
    const first = connect(running.port)
    const tabs = [first, connect(running.port), connect(running.port)]
    await until(() => tabs.every((tab) => shows(tab).length >= 5))
    expect(fake.monitors()).toBe(1)
    const cycles = shows(first).map((line) => line.split(' ')[1])
    expect(new Set(cycles).size).toBe(cycles.length)
  })

  test('does not stay on the server when the only tab leaves while joining', async () => {
    const { server: fake, relay: running } = await start()
    const tab = connect(running.port)
    await new Promise((resolve) => tab.socket.addEventListener('open', resolve))
    tab.socket.close()
    await Bun.sleep(TIMING.silenceMs)
    expect(fake.monitors()).toBe(0)
  })

  test('keeps the session through a stall shorter than the reconnect time', async () => {
    const { server: fake, relay: running } = await start()
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 2)
    fake.hold(true)
    await until(() => tab.lines.includes('{"relay":"status","server":"down","session":1}'))
    const before = shows(tab).length
    fake.hold(false)
    await until(() => tab.lines.includes('{"relay":"status","server":"up","session":1}'))
    await until(() => shows(tab).length > before + 5)
    expect(fake.monitors()).toBe(1)
    expect(tab.lines.some((line) => line.includes('"session":2'))).toBe(false)
  })

  test('hears only the server: nothing before its answer, then only its dedicated port', async () => {
    const init = await udpPeer()
    const dedicated = await udpPeer()
    const intruder = await udpPeer()
    relay = await startRelay(optionsFor(init.socket.port), log, TIMING)
    const tab = connect(relay.port)
    const port = await relayUdpPort()
    await until(() => init.got.includes('(dispinit version 5)'))
    intruder.socket.send('(show 7 (pm 1) (tm a b 0 0))\0', port, '127.0.0.1')
    await until(() => events.some((event) => event.reason === 'before-answer'))
    dedicated.socket.send(`${PARAMS[0] ?? ''}\0`, port, '127.0.0.1')
    dedicated.socket.send('(show 1 (pm 1) (tm a b 0 0))\0', port, '127.0.0.1')
    await until(() => shows(tab).length === 1)
    intruder.socket.send('(show 2 (pm 1) (tm a b 0 0))\0', port, '127.0.0.1')
    intruder.socket.send(`${PARAMS[0] ?? ''}\0`, port, '127.0.0.1')
    await Bun.sleep(100)
    tab.socket.send('(dispstart)')
    await until(() => dedicated.got.includes('(dispstart)'))
    expect(shows(tab)).toEqual(['(show 1 (pm 1) (tm a b 0 0))'])
    expect(tab.lines.filter((line) => line.startsWith('(server_param'))).toHaveLength(1)
    expect(intruder.got).toEqual([])
  })

  test('backs off between (dispinit) and gives up after the last attempt', async () => {
    const silent = await udpPeer()
    relay = await startRelay(optionsFor(silent.socket.port), log, {
      ...TIMING,
      initAttempts: 4,
    })
    connect(relay.port)
    await until(() => events.some((event) => event.event === 'server-gave-up'))
    await Bun.sleep(TIMING.maxRetryMs * 3)
    expect(silent.got).toEqual(Array.from({ length: 4 }, () => '(dispinit version 5)'))
  })

  test('closes pages past the sixteenth with try again later', async () => {
    const { relay: running } = await start()
    const tabs = Array.from({ length: 16 }, () => connect(running.port))
    await until(() => tabs.every((tab) => tab.lines.length > 0))
    const extra = connect(running.port)
    expect(await closed(extra)).toBe(1013)
    expect(tabs.every((tab) => tab.socket.readyState === WebSocket.OPEN)).toBe(true)
  })

  test('shares one command budget across connections', async () => {
    const { relay: running } = await start()
    const first = connect(running.port)
    await until(() => shows(first).length >= 2)
    for (let sent = 0; sent < 4; sent++) first.socket.send('(dispstart)')
    await until(() => events.filter((event) => event.reason === 'not-waiting').length === 4)
    const second = connect(running.port)
    await until(() => shows(second).length >= 1)
    second.socket.send('(dispstart)')
    await until(() => events.some((event) => event.reason === 'rate'))
  })

  test('closes a page that keeps sending refused commands', async () => {
    const { relay: running } = await start()
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 1)
    const code = closed(tab)
    for (let sent = 0; sent < 21; sent++) tab.socket.send('(dispfoul_left 0 0)')
    expect(await code).toBe(1008)
  })

  test('closes a page that sends a message longer than any command', async () => {
    const { server: fake, relay: running } = await start()
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 1)
    const code = closed(tab)
    tab.socket.send(`(dispstart)${' '.repeat(64)}`)
    expect([1006, 1009]).toContain(await code)
    expect(fake.commands).toEqual([])
  })

  test('reconnects when the server comes back', async () => {
    const { server: fake, relay: running } = await start()
    const tab = connect(running.port)
    await until(() => shows(tab).length >= 2)
    fake.stop()
    const before = shows(tab).length
    await until(() => tab.lines.includes('{"relay":"status","server":"down","session":1}'))
    server = await startFakeServer({
      params: PARAMS,
      lines: SHOWS,
      stepMs: 10,
      waitForStart: false,
      port: fake.port,
    })
    await until(() => tab.lines.includes('{"relay":"status","server":"up","session":2}'))
    await until(() => shows(tab).length > before)
  })
})
