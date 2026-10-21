import { beforeEach, describe, expect, test } from 'bun:test'

import type { LiveHandlers } from '@/rcg/live'
import { DEFAULT_LIMITS, type MatchDelta, RcgParser } from '@/rcg/parser'
import { showLine } from '@/test/rcg-builder'

import { useReplay } from './store'

const replay = () => useReplay.getState()

interface Fake {
  handlers: LiveHandlers
  kicks: number
  disconnected: boolean
  stopped: boolean
}

let fake: Fake | null = null
let parser = new RcgParser(DEFAULT_LIMITS, 'monitor')

function handlers(): LiveHandlers {
  if (fake === null) throw new Error('not connected')
  return fake.handlers
}

function connect(): void {
  replay().connect('ws://127.0.0.1:6100', (_url, given) => {
    const opened: Fake = { handlers: given, kicks: 0, disconnected: false, stopped: false }
    fake = opened
    return {
      kickOff: () => {
        opened.kicks++
      },
      disconnect: () => {
        opened.disconnected = true
      },
      save: () => Promise.resolve(new Blob(['ULG6\n'])),
      stop: () => {
        opened.stopped = true
      },
    }
  })
}

function frames(from: number, to: number): MatchDelta {
  parser.push('(server_param (simulator_step 100))')
  for (let cycle = from; cycle <= to; cycle++) {
    parser.push(showLine(cycle, [cycle, 0, 0, 0], [{ side: 'l', unum: 1, x: 0, y: 0 }]))
  }
  const delta = parser.drain()
  if (delta === null) throw new Error('no delta')
  return delta
}

beforeEach(() => {
  replay().close()
  fake = null
  parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
})

describe('live replay', () => {
  test('waits for the first frame, then follows the newest one', () => {
    connect()
    expect(replay()).toMatchObject({
      status: 'loading',
      live: { url: 'ws://127.0.0.1:6100/', phase: 'connecting' },
    })
    handlers().open('up')
    expect(replay().live).toMatchObject({ phase: 'open', server: 'up', following: true })
    handlers().delta(frames(1, 5))
    expect(replay()).toMatchObject({ status: 'ready', frame: 4 })
    expect(replay().analysis).not.toBeNull()
    handlers().delta(frames(6, 8))
    expect(replay().frame).toBe(7)
    expect(replay().match?.frames.count).toBe(8)
  })

  test('scrubbing back stops following; going back to live resumes it', () => {
    connect()
    handlers().delta(frames(1, 5))
    replay().seek(1)
    expect(replay().live?.following).toBe(false)
    handlers().delta(frames(6, 8))
    expect(replay().frame).toBe(1)
    replay().followLive()
    expect(replay()).toMatchObject({ frame: 7, live: { following: true } })
    replay().step(-1)
    expect(replay().live?.following).toBe(false)
    replay().seek(99)
    expect(replay().live?.following).toBe(true)
  })

  test('playing up to the edge picks the live edge up again', () => {
    connect()
    handlers().delta(frames(1, 5))
    replay().seek(2)
    replay().togglePlay()
    replay().advance(10_000)
    expect(replay()).toMatchObject({ frame: 4, playing: false, live: { following: true } })
    replay().togglePlay()
    expect(replay()).toMatchObject({ frame: 4, playing: false })
  })

  test('the analysis lags the frames by at most the throttle', () => {
    connect()
    handlers().delta(frames(1, 5))
    const first = replay().analysis
    handlers().delta(frames(6, 8))
    expect(replay().analysis).toBe(first)
  })

  test('kick-off goes to the connection', () => {
    connect()
    replay().kickOff()
    expect(fake?.kicks).toBe(1)
  })

  test('an end keeps the frames and stops following', () => {
    connect()
    handlers().delta(frames(1, 5))
    handlers().end('restarted')
    expect(replay()).toMatchObject({
      status: 'ready',
      live: { phase: 'ended', end: 'restarted', following: false },
    })
    expect(fake?.stopped).toBe(false)
    replay().followLive()
    expect(replay().live?.following).toBe(false)
    replay().togglePlay()
    expect(replay().playing).toBe(true)
  })

  test('an end before any frame is an error', () => {
    connect()
    handlers().end('unreachable')
    expect(replay()).toMatchObject({ status: 'error', live: null })
    expect(replay().error).toContain('just relay')
    expect(fake?.stopped).toBe(true)
  })

  test('disconnecting keeps the frames; before any frame it goes back to empty', async () => {
    connect()
    handlers().delta(frames(1, 3))
    replay().disconnect()
    expect(replay()).toMatchObject({ status: 'ready', live: { phase: 'ended', end: 'closed' } })
    expect(fake).toMatchObject({ disconnected: true, stopped: false })
    expect(await replay().saveLive()).not.toBeNull()
    const first = fake
    connect()
    expect(first?.stopped).toBe(true)
    replay().disconnect()
    expect(replay()).toMatchObject({ status: 'empty', live: null })
  })

  test('refuses a relay address that is not loopback ws or wss', () => {
    replay().connect('ws://192.168.0.10:6100')
    expect(replay()).toMatchObject({ status: 'error', live: null })
    expect(fake).toBeNull()
  })

  test('closing the viewer leaves the session', () => {
    connect()
    replay().close()
    expect(fake?.stopped).toBe(true)
    expect(replay().live).toBeNull()
  })
})
