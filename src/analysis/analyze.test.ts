import { describe, expect, test } from 'bun:test'

import { parseRcgText } from '@/rcg/parser'
import { playModeId } from '@/rcg/playmodes'
import { PlayerState } from '@/rcg/types'
import { type BallSpec, type PlayerSpec, rcgText, showLine } from '@/test/rcg-builder'

import { analyzeMatch } from './analyze'
import { findEvents } from './events'
import { heatmapOf, offsideLine } from './field'
import { physicsOf } from './params'

const STILL: BallSpec = [0, 0, 0, 0]

function frames(...shows: [BallSpec, PlayerSpec[]][]): string[] {
  return shows.map(([ball, players], i) => showLine(i + 1, ball, players))
}

function parse(...lines: string[]) {
  return parseRcgText(rcgText('(playmode 0 play_on)', ...lines))
}

const l1 = (kick: number, x = -10): PlayerSpec => ({
  side: 'l',
  unum: 1,
  x,
  y: 0,
  counts: { kick },
})
const l2 = (kick: number): PlayerSpec => ({ side: 'l', unum: 2, x: 0, y: 5, counts: { kick } })
const r1 = (kick: number): PlayerSpec => ({ side: 'r', unum: 1, x: 10, y: 0, counts: { kick } })

const striker = (kick: number, x: number): PlayerSpec => ({
  side: 'l',
  unum: 9,
  x,
  y: 0,
  counts: { kick },
})
const runner = (x: number): PlayerSpec => ({ side: 'r', unum: 3, x, y: 0 })
const tackler = (tackle: number, state: number): PlayerSpec => ({
  side: 'r',
  unum: 4,
  x: 0,
  y: 0,
  state,
  counts: { tackle },
})
const victim = (state: number): PlayerSpec => ({ side: 'l', unum: 7, x: 0, y: 0, state })
const offender = (state: number): PlayerSpec => ({ side: 'r', unum: 4, x: 1, y: 0, state })
const defenders = (...xs: number[]): PlayerSpec[] =>
  xs.map((x, i) => ({ side: 'r', unum: i + 1, x, y: 0 }))

describe('analyzeMatch', () => {
  test('pairs each kick with the next touch', () => {
    const match = parse(
      ...frames(
        [STILL, [l1(0), l2(0), r1(0)]],
        [STILL, [l1(1), l2(0), r1(0)]],
        [STILL, [l1(1), l2(1), r1(0)]],
        [STILL, [l1(1), l2(1), r1(1)]],
      ),
      '(playmode 4 kick_in_l)',
      ...frames([STILL, [l1(1), l2(1), r1(1)]]),
    )
    const outcomes = analyzeMatch(match).passes.map(({ from, to, outcome }) => [from, to, outcome])
    expect(outcomes).toEqual([
      [0, 1, 'complete'],
      [1, 11, 'lost'],
      [11, -1, 'stopped'],
    ])
  })

  test('a second kick by the same player is a dribble, not a pass', () => {
    const match = parse(
      ...frames([STILL, [l1(0), l2(0)]], [STILL, [l1(1), l2(0)]], [STILL, [l1(2), l2(0)]]),
      ...frames([STILL, [l1(2), l2(1)]]),
    )
    const { passes, teams } = analyzeMatch(match)
    expect(passes.map((pass) => pass.outcome)).toEqual(['kept', 'complete', 'stopped'])
    expect(teams.l.passes).toBe(2)
    expect(teams.l.passesComplete).toBe(1)
  })

  test('a kick that rolls into the goal is a shot on target, credited when the score moves', () => {
    const match = parse(
      ...frames(
        [STILL, [striker(0, 40)]],
        [[41, 1, 2.5, 0.1], [striker(1, 40)]],
        [[47, 1, 2, 0], [striker(1, 40)]],
      ),
      '(team 4 HELIOS YuShan 1 0)',
      '(playmode 4 goal_l)',
      ...frames([[52.6, 1, 0, 0], [striker(1, 40)]]),
    )
    const { shots, goals, teams } = analyzeMatch(match)
    expect(shots).toHaveLength(1)
    expect(shots[0]?.onTarget).toBe(true)
    expect(goals).toEqual([{ frame: 3, side: 'l', scorer: 8, ownGoal: false }])
    expect(teams.l.goals).toBe(1)
  })

  test('a weak kick or one wide of the posts is no shot', () => {
    const match = parse(
      ...frames(
        [STILL, [striker(0, 30)]],
        [[31, 0, 0.5, 0], [striker(1, 30)]],
        [[31, 0, 2.5, 2.5], [striker(2, 30)]],
        [[31, 0, -2.5, 0], [striker(3, 30)]],
      ),
    )
    expect(analyzeMatch(match).shots).toEqual([])
  })

  test('the last touch by the conceding side makes an own goal', () => {
    const match = parse(
      ...frames([STILL, [l1(0), r1(0)]], [STILL, [l1(1), r1(0)]], [STILL, [l1(1), r1(1)]]),
      '(team 3 A B 1 0)',
    )
    expect(analyzeMatch(match).goals).toEqual([{ frame: 2, side: 'l', scorer: -1, ownGoal: true }])
  })

  test('possession follows the side of the last touch during play', () => {
    const match = parse(
      ...frames(
        [STILL, [l1(0), r1(0)]],
        [STILL, [l1(1), r1(0)]],
        [STILL, [l1(1), r1(0)]],
        [STILL, [l1(1), r1(0)]],
        [STILL, [l1(1), r1(1)]],
      ),
    )
    const { owner, possession } = analyzeMatch(match)
    expect([...owner]).toEqual([-1, 0, 0, 0, 1])
    expect(possession.l).toBeCloseTo(0.75)
  })

  test('distance skips teleports and stopped play', () => {
    const match = parse(
      ...frames(
        [STILL, [runner(0)]],
        [STILL, [runner(0.5)]],
        [STILL, [runner(1)]],
        [STILL, [runner(20)]],
      ),
      '(playmode 5 before_kick_off)',
      ...frames([STILL, [runner(21)]]),
    )
    expect(analyzeMatch(match).players[13]?.distance).toBeCloseTo(1)
  })
})

describe('findEvents', () => {
  test('tells won tackles from missed ones by TACKLE_FAULT', () => {
    const match = parse(
      ...frames(
        [STILL, [tackler(0, PlayerState.STAND)]],
        [STILL, [tackler(1, PlayerState.STAND | PlayerState.TACKLE)]],
        [STILL, [tackler(2, PlayerState.STAND | PlayerState.TACKLE | PlayerState.TACKLE_FAULT)]],
      ),
    )
    expect(findEvents(match).map((event) => event.kind)).toEqual(['tackle', 'tackleMiss'])
  })

  test('a foul counts for the offender side and a card fires once', () => {
    const foul = PlayerState.STAND | PlayerState.FOUL_CHARGED
    const booked = PlayerState.STAND | PlayerState.YELLOW_CARD
    const match = parse(
      ...frames(
        [STILL, [victim(PlayerState.STAND), offender(PlayerState.STAND)]],
        [STILL, [victim(foul), offender(booked)]],
        [STILL, [victim(foul), offender(booked)]],
      ),
    )
    const events = findEvents(match).map(({ kind, slot, side }) => [kind, slot, side])
    expect(events).toEqual([
      ['fouled', 6, 'r'],
      ['yellow', 14, 'r'],
    ])
  })

  test('marks set pieces but not the return to play', () => {
    const match = parse(
      ...frames([STILL, []]),
      '(playmode 2 corner_kick_r)',
      ...frames([STILL, []]),
      '(playmode 3 play_on)',
      ...frames([STILL, []]),
    )
    const modes = findEvents(match).map((event) => [event.frame, event.mode, event.side])
    expect(modes).toEqual([[1, playModeId('corner_kick_r') ?? -1, 'r']])
  })
})

describe('offsideLine', () => {
  test('sits on the second-to-last defender, no deeper than the ball', () => {
    const match = parse(
      ...frames([[10, 0, 0, 0], defenders(50, 45, 30)], [[48, 0, 0, 0], defenders(50, 45, 30)]),
    )
    expect(offsideLine(match, 0, 'r')).toBe(45)
    expect(offsideLine(match, 1, 'r')).toBe(48)
  })

  test('never goes past the halfway line and needs two defenders', () => {
    const match = parse(...frames([[-20, 0, 0, 0], defenders(-5, -10)], [STILL, defenders(40)]))
    expect(offsideLine(match, 0, 'r')).toBe(0)
    expect(offsideLine(match, 1, 'r')).toBeNull()
  })

  test('skips a disconnected defender', () => {
    const gone: PlayerSpec = { side: 'r', unum: 2, x: 45, y: -37, state: PlayerState.YELLOW_CARD }
    const keeper: PlayerSpec = { side: 'r', unum: 1, x: 50, y: 0 }
    const back: PlayerSpec = { side: 'r', unum: 3, x: 30, y: 0 }
    const match = parse(
      ...frames([
        [10, 0, 0, 0],
        [keeper, gone, back],
      ]),
    )
    expect(offsideLine(match, 0, 'r')).toBe(30)
  })
})

describe('heatmapOf', () => {
  test('counts play_on frames in the cell under the ball', () => {
    const match = parse(
      ...frames([[-52, -33, 0, 0], []], [[52, 33, 0, 0], []], [[52, 33, 0, 0], []]),
    )
    const map = heatmapOf(match, { cols: 2, rows: 2, subject: 'ball' })
    expect([...map.cells]).toEqual([1, 0, 0, 2])
    expect(map.peak).toBe(2)
  })
})

describe('physicsOf', () => {
  test('reads the server parameters and falls back to the defaults', () => {
    const match = parseRcgText(
      rcgText(
        '(server_param (goal_width 20)(half_time 300)(simulator_step 100))',
        '(player_type (id 0)(kickable_margin 0.65))',
        showLine(1, STILL, []),
      ),
    )
    const physics = physicsOf(match)
    expect(physics.goalWidth).toBe(20)
    expect(physics.ballDecay).toBe(0.94)
    expect(physics.halfCycles).toBe(3000)
    expect(physics.stepMs).toBe(100)
    expect(physics.kickableMargins).toEqual([0.65])
  })
})
