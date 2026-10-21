import { describe, expect, test } from 'bun:test'

import { analyzeMatch } from '@/analysis/analyze'
import { parseRcgText } from '@/rcg/parser'
import { PlayerState } from '@/rcg/types'
import { rcgText, showLine } from '@/test/rcg-builder'

import {
  clockOf,
  cycleAt,
  distance,
  frameOfCycle,
  percent,
  playerName,
  speedLabel,
  teamName,
} from './format'
import { MOMENT_LEAD_FRAMES, momentJump, momentsOf, nextMoment } from './moments'

const STAND = PlayerState.STAND

const match = parseRcgText(
  rcgText(
    '(playmode 0 before_kick_off)',
    '(team 0 Azul Laranja 0 0)',
    showLine(0, [0, 0, 0, 0], [{ side: 'l', unum: 9, x: 0, y: 0 }]),
    '(playmode 1 play_on)',
    showLine(1, [0, 0, 0, 0], [{ side: 'l', unum: 9, x: 0, y: 0 }]),
    showLine(1, [0, 0, 0, 0], [{ side: 'l', unum: 9, x: 0, y: 0 }]),
    showLine(2, [40, 0, 3, 0], [{ side: 'l', unum: 9, x: 40, y: 0, counts: { kick: 1 } }]),
    '(playmode 3 goal_l)',
    '(team 3 Azul Laranja 1 0)',
    showLine(3, [53, 0, 0, 0], [{ side: 'l', unum: 9, x: 40, y: 0, counts: { kick: 1 } }]),
    showLine(
      4,
      [0, 0, 0, 0],
      [
        {
          side: 'l',
          unum: 9,
          x: 0,
          y: 0,
          state: STAND | PlayerState.YELLOW_CARD,
          counts: { kick: 1 },
        },
      ],
    ),
  ),
)

describe('format', () => {
  test('maps cycles and frames both ways across a stopped clock', () => {
    expect(frameOfCycle(match, 1)).toBe(1)
    expect(frameOfCycle(match, 2)).toBe(3)
    expect(frameOfCycle(match, 99)).toBe(5)
    expect(cycleAt(match, 2.4)).toBe(1)
    expect(cycleAt(match, -1)).toBe(0)
  })

  test('formats the clock, names, shares and distances', () => {
    expect(clockOf(6000, 100)).toBe('10:00')
    expect(clockOf(65, 100)).toBe('00:06')
    expect(teamName(match, 'r')).toBe('Laranja')
    expect(playerName(match, 8)).toBe('Azul 9')
    expect(playerName(match, 11)).toBe('Laranja 1')
    expect(percent(0.666)).toBe('67%')
    expect(distance(1234.4)).toBe('1.234 m')
    expect(distance(12_340)).toBe('12,3 km')
    expect([0.25, 0.5, 1, 16].map(speedLabel)).toEqual(['¼×', '½×', '1×', '16×'])
  })
})

describe('moments', () => {
  const moments = momentsOf(match, analyzeMatch(match))

  test('lists the goal with its scorer and the card', () => {
    expect(moments.map((moment) => moment.kind)).toEqual(['shot', 'goal', 'card'])
    expect(moments[1]?.text).toBe('Gol de Azul 9')
    expect(moments[2]?.text).toBe('Amarelo para Azul 9')
  })

  test('jumps to the next and previous moment of a kind', () => {
    const goals = new Set(['goal'] as const)
    expect(nextMoment(moments, 0, 1, goals)?.frame).toBe(4)
    expect(nextMoment(moments, 4, 1)?.kind).toBe('card')
    expect(nextMoment(moments, 4, -1)?.kind).toBe('shot')
    expect(nextMoment(moments, 5, 1)).toBeUndefined()
  })

  test('lands before a moment and walks on when jumping again', () => {
    const synthetic = [100, 200].map((frame) => ({ ...moments[0]!, frame }))
    const first = momentJump(synthetic, 0, 1)
    expect(first).toBe(100 - MOMENT_LEAD_FRAMES)
    expect(momentJump(synthetic, first ?? 0, 1)).toBe(200 - MOMENT_LEAD_FRAMES)
    expect(momentJump(synthetic, 200 - MOMENT_LEAD_FRAMES, -1)).toBe(100 - MOMENT_LEAD_FRAMES)
    expect(momentJump(synthetic, 100 - MOMENT_LEAD_FRAMES, -1)).toBeNull()
    const early = [{ ...moments[0]!, frame: 10 }]
    expect(momentJump(early, 0, 1)).toBeNull()
    expect(momentJump(early, 5, -1)).toBe(0)
  })
})
