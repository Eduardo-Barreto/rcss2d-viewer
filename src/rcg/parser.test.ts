import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DEFAULT_LIMITS, parseRcgText } from './parser'
import { PLAY_ON, playModeId } from './playmodes'
import { RcgError } from './scanner'
import { readRcgStream } from './stream'
import { COUNTER_INDEX, COUNTERS, PlayerState, SLOT_COUNT } from './types'

const FIXTURE = join(import.meta.dir, 'fixtures', 'rcss2d-mirror-300.rcg.gz')

const PLAYER_L1 =
  '((l 1) 0 0x9 -50 0 0.1 -0.2 45 -10 (v h 180) (fp 3 -10) (s 7000 0.9 1 120000) (f r 9) (c 1 2 3 4 5 6 7 8 9 10 11 12))'
const PLAYER_R9 =
  '((r 9) 3 0x1003 10.5 -3.25 0 0 -170 20 11 -4 (v l 60) (s 8000 1 1 130600) (c 0 0 0 0 0 0 0 0 0 0 0 0))'

function show(cycle: number, ball = '((b) 1 2 0.5 -0.5)') {
  return `(show ${cycle} ${ball} ${PLAYER_L1} ${PLAYER_R9})`
}

function log(...lines: string[]) {
  return ['ULG6', ...lines].join('\n')
}

async function failure(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending
  } catch (error) {
    return error
  }
  return null
}

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Blob([new Uint8Array(bytes)]).stream()
}

describe('parseRcgText', () => {
  test('reads ball and players into columns', () => {
    const match = parseRcgText(log(show(1)))
    const f = match.frames
    expect(f.count).toBe(1)
    expect([...f.ball]).toEqual([1, 2, 0.5, -0.5])

    const l1 = 0
    expect(f.type[l1]).toBe(0)
    expect(f.state[l1]).toBe(PlayerState.STAND | PlayerState.GOALIE)
    expect(f.players.x[l1]).toBe(-50)
    expect(f.players.body[l1]).toBe(45)
    expect(f.players.pointX[l1]).toBeNaN()
    expect(f.players.focusDist[l1]).toBe(3)
    expect(f.players.capacity[l1]).toBe(120000)
    expect(f.viewHigh[l1]).toBe(1)
    expect(f.focusTarget[l1]).toBe(11 + 8)
    expect(f.counts[l1 * COUNTERS.length + COUNTER_INDEX.changeFocus]).toBe(12)

    const r9 = 11 + 8
    expect(f.type[r9]).toBe(3)
    expect(f.state[r9]).toBe(0x1003)
    expect(f.players.pointX[r9]).toBeCloseTo(11)
    expect(f.players.pointY[r9]).toBeCloseTo(-4)
    expect(f.viewHigh[r9]).toBe(0)
    expect(f.players.viewWidth[r9]).toBe(60)

    expect(f.type[1]).toBe(-1)
  })

  test('attaches play modes, scores and messages to the next frame', () => {
    const match = parseRcgText(
      log(
        '(playmode 1 kick_off_l)',
        '(team 1 HELIOS null 0 0)',
        show(1),
        '(playmode 2 play_on)',
        '(msg 2 1 "hello "quoted" world")',
        show(2),
        '(team 3 HELIOS YuShan 1 0)',
        show(3),
      ),
    )
    expect(match.leftName).toBe('HELIOS')
    expect(match.rightName).toBe('YuShan')
    expect([...match.frames.playmode]).toEqual([playModeId('kick_off_l') ?? -1, PLAY_ON, PLAY_ON])
    expect([...match.frames.scoreLeft]).toEqual([0, 0, 1])
    expect(match.messages).toEqual([{ frame: 1, cycle: 2, board: 1, text: 'hello "quoted" world' }])
    expect(match.scores.at(-1)?.frame).toBe(2)
  })

  test('keeps penalty fields of the team line', () => {
    const match = parseRcgText(log('(team 1 A B 2 2 4 1 3 2)', show(1)))
    expect(match.scores[0]).toMatchObject({
      left: 2,
      right: 2,
      penaltiesLeft: 4,
      penaltyMissesLeft: 1,
      penaltiesRight: 3,
      penaltyMissesRight: 2,
    })
  })

  test('skips pm and tm groups of older show lines', () => {
    const match = parseRcgText(log(`(show 5 (pm 3) (tm A B 0 0) ((b) 0 0 0 0) ${PLAYER_L1})`))
    expect(match.frames.cycle[0]).toBe(5)
    expect(match.frames.type[0]).toBe(0)
  })

  test('reads parameters into maps, numbers as numbers', () => {
    const match = parseRcgText(
      log(
        '(server_param (goal_width 14.02)(team_l_start "")(__proto__ 1))',
        '(player_type (id 0)(player_speed_max 1.05))',
        show(1),
      ),
    )
    expect(match.serverParams.get('goal_width')).toBe(14.02)
    expect(match.serverParams.get('team_l_start')).toBe('')
    expect(match.serverParams.get('__proto__')).toBe(1)
    expect(match.playerTypes[0]?.get('player_speed_max')).toBe(1.05)
  })

  test('decodes team graphic tiles', () => {
    const match = parseRcgText(
      log('(msg 0 1 "(team_graphic_l (3 1 "2 1 2 1" "a c #FF0000" "b c None" "ab")")', show(1)),
    )
    const tile = match.graphics.l[0]
    expect(tile).toMatchObject({ x: 3, y: 1, width: 2, height: 1 })
    expect([...(tile?.rgba ?? [])]).toEqual([255, 0, 0, 255, 0, 0, 0, 0])
    expect(match.messages).toEqual([])
  })

  test('counts unknown lines instead of failing', () => {
    const match = parseRcgText(log('(draw 1 (circle 0 0 1))', show(1)))
    expect(match.skippedLines).toBe(1)
  })
})

describe('parseRcgText refuses bad input', () => {
  const cases: [string, string][] = [
    ['an unknown header', 'hello\n'],
    ['a binary version', 'ULG3\n'],
    ['a log with no frames', log('(playmode 1 play_on)')],
    ['a side other than l or r', log(show(1).replace('(l 1)', '(x 1)'))],
    ['a uniform number above 11', log(show(1).replace('(l 1)', '(l 12)'))],
    ['a coordinate that is not finite', log(show(1, '((b) 1e999 0 0 0)'))],
    ['a frame with no ball', log(`(show 1 ${PLAYER_L1})`)],
    ['unbalanced parentheses', log('(show 1 ((b) 0 0 0 0) ((l 1) 0 0x1 0 0 0 0 0 0 (v h')],
  ]
  for (const [name, text] of cases) {
    test(`fails on ${name}`, () => {
      expect(() => parseRcgText(text)).toThrow(RcgError)
    })
  }

  test('stops at the frame limit', () => {
    const text = log(show(1), show(2), show(3))
    expect(() => parseRcgText(text, { ...DEFAULT_LIMITS, maxFrames: 2 })).toThrow(/quadros/)
  })

  test('stops at the line length limit', () => {
    expect(() => parseRcgText(log(show(1)), { ...DEFAULT_LIMITS, maxLineLength: 50 })).toThrow(
      /tamanho/,
    )
  })
})

describe('readRcgStream', () => {
  test('reads the gzipped fixture from one of our matches', async () => {
    const match = await readRcgStream(streamOf(readFileSync(FIXTURE)))
    expect(match.version).toBe(6)
    expect(match.leftName).toBe('rcss2d')
    expect(match.rightName).toBe('mirror')
    expect(match.frames.count).toBe(299)
    expect(match.frames.cycle[0]).toBe(1)
    expect(match.frames.cycle[298]).toBe(300)
    expect(match.playerTypes).toHaveLength(18)
    expect(match.serverParams.get('goal_width')).toBeNumber()
    const present = [...match.frames.type.subarray(0, SLOT_COUNT)].filter((t) => t >= 0)
    expect(present).toHaveLength(SLOT_COUNT)
  })

  test('reads plain text the same as gzip', async () => {
    const text = new TextEncoder().encode(log(show(1), show(2)))
    const match = await readRcgStream(streamOf(text))
    expect(match.frames.count).toBe(2)
  })

  test('stops a gzip bomb at the decompressed size limit', async () => {
    const bytes = readFileSync(FIXTURE)
    const limits = { ...DEFAULT_LIMITS, maxBytes: 64 * 1024 }
    expect(String(await failure(readRcgStream(streamOf(bytes), undefined, limits)))).toMatch(
      /limite/,
    )
  })

  test('reports corrupt gzip as an RcgError', async () => {
    const bytes = readFileSync(FIXTURE).subarray(0, 5000)
    expect(await failure(readRcgStream(streamOf(bytes)))).toBeInstanceOf(RcgError)
  })

  test('refuses JSON logs with a clear message', async () => {
    const bytes = new TextEncoder().encode('[{"version":-1}]')
    expect(String(await failure(readRcgStream(streamOf(bytes))))).toMatch(/JSON/)
  })
})
