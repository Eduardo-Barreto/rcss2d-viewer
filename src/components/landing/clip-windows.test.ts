import { describe, expect, test } from 'bun:test'

import { frameOfCycle } from '@/player/format'
import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { GOAL_CYCLE, clipWindows } from './clip-windows'

const FIRST = 2490
const LAST = 2725

const match = parseRcgText(
  rcgText(
    ...Array.from({ length: LAST - FIRST + 1 }, (_, i) =>
      showLine(FIRST + i, [0, 0, 0, 0], [{ side: 'l', unum: 1, x: 0, y: 0 }]),
    ),
  ),
)

describe('clipWindows', () => {
  test('loops the hero from the build-up to just after the goal', () => {
    const { hero } = clipWindows(match)
    const goal = frameOfCycle(match, GOAL_CYCLE)
    expect(hero.from).toBe(frameOfCycle(match, 2600))
    expect(hero.to).toBeGreaterThan(goal)
    expect(hero.still).toBeLessThan(goal)
    expect(hero.still).toBeGreaterThanOrEqual(hero.from)
  })

  test('covers every frame and holds on the goal when motion is reduced', () => {
    const { whole } = clipWindows(match)
    expect(whole).toEqual({
      from: 0,
      to: match.frames.count - 1,
      still: frameOfCycle(match, GOAL_CYCLE),
    })
  })
})
