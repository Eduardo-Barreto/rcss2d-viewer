import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { frameBytes } from '@/test/frame-bytes'
import { asMonitorLines } from '@/test/monitor-lines'
import { showLine } from '@/test/rcg-builder'

import { LiveMatch } from './live-match'
import {
  LIVE_LIMITS,
  type LiveSession as Session,
  LiveSession,
  type LiveSocket,
} from './live-session'
import { DEFAULT_LIMITS, type RcgLimits, parseRcgText } from './parser'
import type { LiveReply } from './protocol'

const FIXTURE = join(import.meta.dir, 'fixtures', 'rcss2d-mirror-300.rcg.gz')
const fixtureText = gunzipSync(readFileSync(FIXTURE)).toString('utf8')
const STREAM = join(import.meta.dir, 'fixtures', 'rcss2d-mirror-live-215.txt.gz')
const streamLines = gunzipSync(readFileSync(STREAM))
  .toString('utf8')
  .split('\n')
  .filter((line) => line !== '')
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

function start(maxFrames = DEFAULT_LIMITS.maxFrames, limits: Partial<RcgLimits> = {}) {
  const socket = new FakeSocket()
  const replies: LiveReply[] = []
  const transfers: Transferable[][] = []
  const session = new LiveSession(
    'ws://127.0.0.1:6100',
    (reply, transfer) => {
      replies.push(reply)
      transfers.push(transfer)
    },
    { open: () => socket, limits: { ...LIVE_LIMITS, maxFrames, ...limits }, flushMs: 60_000 },
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

  test('saves what arrived as a version 6 .rcg that reads like the original', async () => {
    const { socket, session } = start()
    socket.open()
    socket.deliver(UP)
    for (const line of asMonitorLines(fixtureText)) socket.deliver(line)
    const file = await session.save()
    if (file === null) throw new Error('nothing saved')
    const text = gunzipSync(new Uint8Array(await file.arrayBuffer())).toString('utf8')
    const original = parseRcgText(fixtureText)
    const saved = parseRcgText(text)
    expect(text.startsWith('ULG6\n')).toBe(true)
    expect(text).not.toContain('(pm ')
    expect(saved.frames).toEqual(original.frames)
    expect(saved.playmodes).toEqual(original.playmodes)
    expect(saved.scores).toEqual(original.scores.slice(0, 1))
    expect(saved.serverParams).toEqual(original.serverParams)
  })

  test('saves a real stream with two teams as a .rcg that reads back to the same match', async () => {
    const { socket, replies, session } = start()
    socket.open()
    socket.deliver(UP)
    for (const line of streamLines) socket.deliver(line)
    session.flush()
    const live = new LiveMatch()
    let shown = null
    for (const reply of replies) {
      if (reply.kind === 'live-delta') shown = live.apply(reply.delta) ?? shown
    }
    const file = await session.save()
    if (file === null || shown === null) throw new Error('nothing arrived')
    const saved = parseRcgText(
      gunzipSync(new Uint8Array(await file.arrayBuffer())).toString('utf8'),
    )
    expect(saved.skippedLines).toBe(0)
    expect(frameBytes(saved.frames)).toEqual(frameBytes(shown.frames))
    expect(saved.playmodes).toEqual(shown.playmodes)
    expect([saved.leftName, saved.rightName]).toEqual(['left', 'right'])
    expect(saved.messages).toEqual(shown.messages)
    expect(saved.playerTypes).toEqual(shown.playerTypes)
  })

  test('keeps every show line in the save once the play mode changes pass the event limit', async () => {
    const { socket, session } = start(DEFAULT_LIMITS.maxFrames, { maxEvents: 1 })
    socket.open()
    socket.deliver(UP)
    for (const line of asMonitorLines(fixtureText)) socket.deliver(line)
    const file = await session.save()
    if (file === null) throw new Error('nothing saved')
    const saved = parseRcgText(
      gunzipSync(new Uint8Array(await file.arrayBuffer())).toString('utf8'),
    )
    expect(saved.frames.count).toBe(parseRcgText(fixtureText).frames.count)
  })

  test('keeps at most 128 MiB of lines for saving a live match', () => {
    expect(LIVE_LIMITS.maxBytes).toBe(128 * 1_048_576)
    expect(LIVE_LIMITS.maxBytes).toBeLessThan(DEFAULT_LIMITS.maxBytes)
  })

  test('saves one frame for a wait the parser folded, and nothing before any line', async () => {
    const { socket, session } = start()
    expect(await session.save()).toBeNull()
    socket.open()
    for (const ball of [1, 2, 3]) {
      socket.deliver(
        showLine(0, [ball, 0, 0, 0], []).replace('(show 0', '(show 0 (pm 1) (tm a b 0 0)'),
      )
    }
    const file = await session.save()
    if (file === null) throw new Error('nothing saved')
    const saved = parseRcgText(
      gunzipSync(new Uint8Array(await file.arrayBuffer())).toString('utf8'),
    )
    expect(saved.frames.count).toBe(1)
    expect(saved.frames.ball[0]).toBe(3)
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
