import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'

import { rcgText, showLine } from '@/test/rcg-builder'

import { FrameStore } from './columns'
import { LiveMatch } from './live-match'
import { DEFAULT_LIMITS, type MatchDelta, RcgParser, parseRcgText } from './parser'
import { PLAYMODES, playModeId } from './playmodes'
import { RcgError } from './scanner'
import type { Match } from './types'

const FIXTURE = join(import.meta.dir, 'fixtures', 'rcss2d-mirror-300.rcg.gz')
const fixtureText = gunzipSync(readFileSync(FIXTURE)).toString('utf8')
const SHOW_HEAD = /^\(show (?<cycle>\d+)/

/**
 * Rewrites a v6 file as a monitor connection would have received it: no header, no
 * `(playmode)` or `(team)` lines, and `(pm N) (tm ...)` at the start of every show.
 */
function asMonitorLines(text: string): string[] {
  let mode = 0
  let team = 'null null 0 0'
  const lines: string[] = []
  for (const line of text.split('\n').slice(1)) {
    const words = line.slice(1, -1).split(' ')
    if (line.startsWith('(playmode ')) mode = playModeId(words[2] ?? '') ?? mode
    else if (line.startsWith('(team ')) team = words.slice(2).join(' ')
    else if (line.startsWith('(show ')) {
      lines.push(line.replace(SHOW_HEAD, (head) => `${head} (pm ${mode}) (tm ${team})`))
    } else if (line !== '') lines.push(line)
  }
  return lines
}

function drained(parser: RcgParser): MatchDelta {
  const delta = parser.drain()
  if (delta === null) throw new Error('nothing to drain')
  return delta
}

function feedMonitor(lines: string[], parser = new RcgParser(DEFAULT_LIMITS, 'monitor')) {
  const live = new LiveMatch()
  let match: Match | null = null
  lines.forEach((line, index) => {
    parser.push(line)
    if (index % 7 === 0) {
      const delta = parser.drain()
      if (delta !== null) match = live.apply(delta) ?? match
    }
  })
  const delta = parser.drain()
  if (delta !== null) match = live.apply(delta) ?? match
  return { parser, match }
}

const mode = (name: string) => playModeId(name) ?? -1

describe('monitor parser', () => {
  test('reads a monitor stream into the same frames as the file', () => {
    const file = parseRcgText(fixtureText)
    const { parser, match } = feedMonitor(asMonitorLines(fixtureText))
    const finished = parser.finish()
    expect(finished.frames).toEqual(file.frames)
    expect(match).not.toBeNull()
    expect(match?.frames).toEqual(file.frames)
    expect(finished.playmodes).toEqual(file.playmodes)
    // The file repeats an unchanged `(team)` at the end; a show only records a change.
    expect(finished.scores).toEqual(file.scores.slice(0, 1))
    expect(finished.leftName).toBe(file.leftName)
    expect(finished.serverParams).toEqual(file.serverParams)
    expect(finished.playerTypes).toHaveLength(file.playerTypes.length)
  })

  test('keeps one frame while the clock waits before the kick-off', () => {
    const waiting = mode('before_kick_off')
    const shows = [0, 0, 0, 0].map((cycle, i) =>
      showLine(cycle, [i, 0, 0, 0], []).replace('(show 0', `(show 0 (pm ${waiting})`),
    )
    const kickOff = showLine(0, [9, 0, 0, 0], []).replace(
      '(show 0',
      `(show 0 (pm ${mode('kick_off_l')})`,
    )
    const parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
    for (const line of shows) parser.push(line)
    expect(parser.frameCount).toBe(1)
    parser.push(kickOff)
    const match = parser.finish()
    expect(match.frames.count).toBe(2)
    expect(match.frames.ball[0]).toBe(3)
    expect(match.playmodes.map((change) => PLAYMODES[change.mode])).toEqual([
      'before_kick_off',
      'kick_off_l',
    ])
  })

  test('resends a frame rewritten while waiting, and only new entries', () => {
    const waiting = `(pm ${mode('before_kick_off')}) (tm alpha null 0 0)`
    const parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
    parser.push(showLine(0, [1, 0, 0, 0], []).replace('(show 0', `(show 0 ${waiting}`))
    const first = parser.drain()
    expect(first).toMatchObject({ from: 0, leftName: 'alpha' })
    expect(first?.playmodes).toHaveLength(1)
    expect(parser.drain()).toBeNull()
    parser.push(showLine(0, [2, 0, 0, 0], []).replace('(show 0', `(show 0 ${waiting}`))
    const second = parser.drain()
    expect(second).toMatchObject({ from: 0, playmodes: [], scores: [] })
    expect(second?.frames.count).toBe(1)
    expect(second?.frames.ball[0]).toBe(2)
  })

  test('records a goal from the score inside the show', () => {
    const parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
    for (const [cycle, score] of [
      [1, '0 0'],
      [2, '0 0'],
      [3, '1 0'],
    ] as const) {
      parser.push(showLine(cycle, [0, 0, 0, 0], []).replace(/^\(show \d+/, `$& (tm a b ${score})`))
    }
    const match = parser.finish()
    expect(match.scores.map((change) => [change.frame, change.left])).toEqual([
      [0, 0],
      [2, 1],
    ])
    expect([...match.frames.scoreLeft]).toEqual([0, 0, 1])
  })

  test('refuses a play mode id the server does not have', () => {
    const parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
    expect(() =>
      parser.push(showLine(1, [0, 0, 0, 0], []).replace('(show 1', '(show 1 (pm 999)')),
    ).toThrow(RcgError)
    expect(parser.frameCount).toBe(0)
  })

  test('stops at the frame limit', () => {
    const parser = new RcgParser({ ...DEFAULT_LIMITS, maxFrames: 2 }, 'monitor')
    parser.push(showLine(1, [0, 0, 0, 0], []))
    parser.push(showLine(2, [0, 0, 0, 0], []))
    expect(() => parser.push(showLine(3, [0, 0, 0, 0], []))).toThrow('O log passa de 2 quadros.')
  })
})

describe('FrameStore', () => {
  test('grows past its first capacity by doubling and keeps every frame', () => {
    const lines = Array.from({ length: 2500 }, (_, i) => showLine(i + 1, [i, 0, 0, 0], []))
    const match = parseRcgText(rcgText(...lines))
    expect(match.frames.count).toBe(2500)
    expect(match.frames.ball[2499 * 4]).toBe(2499)
    expect(match.frames.type.every((type) => type === -1)).toBe(true)
  })

  test('writes a batch over the tail it replaces and refuses a gap or the limit', () => {
    const parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
    for (let i = 1; i <= 3; i++) parser.push(showLine(i, [i, 0, 0, 0], []))
    const frames = parser.finish().frames
    const store = new FrameStore(4)
    expect(store.write(0, frames)).toBe(true)
    expect(store.write(2, frames)).toBe(false)
    expect(store.write(1, frames)).toBe(true)
    expect(store.count).toBe(4)
    expect([...store.view().cycle]).toEqual([1, 1, 2, 3])
    expect(store.write(5, frames)).toBe(false)
  })
})

describe('LiveMatch', () => {
  test('waits for a frame before it has a match', () => {
    const parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
    parser.push('(server_param (simulator_step 100))')
    const delta = drained(parser)
    expect(new LiveMatch().apply(delta)).toBeNull()
  })

  test('refuses a batch that leaves a hole', () => {
    const parser = new RcgParser(DEFAULT_LIMITS, 'monitor')
    parser.push(showLine(1, [0, 0, 0, 0], []))
    const delta = drained(parser)
    expect(() => new LiveMatch().apply({ ...delta, from: 3 })).toThrow(RcgError)
  })
})
