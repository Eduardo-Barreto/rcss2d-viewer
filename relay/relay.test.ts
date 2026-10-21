import { afterEach, describe, expect, test } from 'bun:test'

import type { RelayOptions } from './args.ts'
import { type FakeServer, startFakeServer } from './fake-server.ts'
import { type Relay, type RelayLog, startRelay } from './relay.ts'

const ORIGIN = 'http://localhost:5173'
const PARAMS = ['(server_param (half_time 300))', '(player_param (player_types 18))']
const SHOWS = Array.from({ length: 400 }, (_, cycle) => `(show ${cycle + 1} (pm 2) (tm a b 0 0))`)
const TIMING = { retryMs: 20, silenceMs: 200, reconnectMs: 600 }
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
  await relay?.stop()
  server?.stop()
  relay = null
  server = null
  events.length = 0
})

async function start(waitForStart = false): Promise<{ server: FakeServer; relay: Relay }> {
  server = await startFakeServer({ params: PARAMS, lines: SHOWS, stepMs: 10, waitForStart })
  const options: RelayOptions = {
    server: { host: '127.0.0.1', port: server.port },
    listen: { host: '127.0.0.1', port: 0 },
    allowRemote: false,
    allowNoOrigin: false,
  }
  relay = await startRelay(options, log, TIMING)
  return { server, relay }
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
