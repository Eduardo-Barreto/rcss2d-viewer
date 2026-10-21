import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { asMonitorLines } from '@/test/monitor-lines'
import { showLine } from '@/test/rcg-builder'

import { LiveMatch } from './live-match'
import { type LiveSession as Session, LiveSession, type LiveSocket } from './live-session'
import { DEFAULT_LIMITS, parseRcgText } from './parser'
import type { LiveReply } from './protocol'

const FIXTURE = join(import.meta.dir, 'fixtures', 'rcss2d-mirror-300.rcg.gz')
const fixtureText = gunzipSync(readFileSync(FIXTURE)).toString('utf8')
const UP = '{"relay":"status","server":"up","session":1}'

class FakeSocket extends EventTarget implements LiveSocket {
  readyState: WebSocket['readyState'] = WebSocket.CONNECTING
  sent: string[] = []
  closed = false

  send(text: string): void {
    this.sent.push(text)
  }

  close(): void {
    this.closed = true
    this.readyState = WebSocket.CLOSED
  }

  open(): void {
    this.readyState = WebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  deliver(text: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: text }))
  }

  drop(): void {
    this.readyState = WebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
}

const sessions: Session[] = []
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop()
})

function start(maxFrames = DEFAULT_LIMITS.maxFrames) {
  const socket = new FakeSocket()
  const replies: LiveReply[] = []
  const transfers: Transferable[][] = []
  const session = new LiveSession(
    'ws://127.0.0.1:6100',
    (reply, transfer) => {
      replies.push(reply)
      transfers.push(transfer)
    },
    { open: () => socket, limits: { ...DEFAULT_LIMITS, maxFrames }, flushMs: 60_000 },
  )
  sessions.push(session)
  return { socket, replies, transfers, session }
}

const ends = (replies: LiveReply[]) =>
  replies.flatMap((reply) => (reply.kind === 'live-end' ? [reply.reason] : []))

describe('LiveSession', () => {
  test('batches the relay lines into the same match the file gives', () => {
    const { socket, replies, transfers, session } = start()
    socket.open()
    socket.deliver(UP)
    const live = new LiveMatch()
    asMonitorLines(fixtureText).forEach((line, index) => {
      socket.deliver(line)
      if (index % 50 === 0) session.flush()
    })
    session.flush()
    let frames = null
    for (const reply of replies) {
      if (reply.kind === 'live-delta') frames = live.apply(reply.delta)?.frames ?? frames
    }
    expect(replies[0]).toEqual({ kind: 'live-open', server: 'up' })
    expect(frames).toEqual(parseRcgText(fixtureText).frames)
    expect(transfers.some((list) => list.length > 0)).toBe(true)
  })

  test('sends nothing when nothing arrived', () => {
    const { replies, session } = start()
    session.flush()
    expect(replies).toEqual([])
  })

  test('a relay that never opens is unreachable', () => {
    const { socket, replies } = start()
    socket.drop()
    expect(ends(replies)).toEqual(['unreachable'])
  })

  test('a relay that goes away after opening is closed, with the last frames sent first', () => {
    const { socket, replies } = start()
    socket.open()
    socket.deliver(showLine(1, [0, 0, 0, 0], []))
    socket.drop()
    expect(replies.map((reply) => reply.kind)).toEqual(['live-delta', 'live-end'])
    expect(ends(replies)).toEqual(['closed'])
  })

  test('a new server session after frames ends this one', () => {
    const { socket, replies } = start()
    socket.open()
    socket.deliver(UP)
    socket.deliver(showLine(1, [0, 0, 0, 0], []))
    socket.deliver('{"relay":"status","server":"down","session":1}')
    socket.deliver('{"relay":"status","server":"up","session":2}')
    expect(ends(replies)).toEqual(['restarted'])
    expect(socket.closed).toBe(true)
  })

  test('a new session before any frame is just adopted', () => {
    const { socket, replies } = start()
    socket.open()
    socket.deliver('{"relay":"status","server":"down","session":0}')
    socket.deliver(UP)
    expect(ends(replies)).toEqual([])
  })

  test('stops at the frame limit', () => {
    const { socket, replies } = start(2)
    socket.open()
    for (const cycle of [1, 2, 3]) socket.deliver(showLine(cycle, [0, 0, 0, 0], []))
    expect(ends(replies)).toEqual(['full'])
  })

  test.each([[new Uint8Array([1])], ['{"relay":"nope"}'], ['{not json']])(
    'ends on what is not a monitor line: %p',
    (payload) => {
      const { socket, replies } = start()
      socket.open()
      socket.deliver(payload)
      expect(ends(replies)).toEqual(['invalid'])
    },
  )

  test('skips a line that does not parse and keeps going', () => {
    const { socket, replies, session } = start()
    socket.open()
    socket.deliver('(show x)')
    socket.deliver(showLine(1, [0, 0, 0, 0], []))
    session.flush()
    const delta = replies.find((reply) => reply.kind === 'live-delta')
    expect(ends(replies)).toEqual([])
    expect(delta?.kind === 'live-delta' && delta.delta.skippedLines).toBe(1)
  })

  test('passes a command only while open, and none after stop', () => {
    const { socket, session } = start()
    session.command('(dispstart)')
    socket.open()
    session.command('(dispstart)')
    session.stop()
    session.command('(dispstart)')
    expect(socket.sent).toEqual(['(dispstart)'])
    expect(socket.closed).toBe(true)
  })
})
