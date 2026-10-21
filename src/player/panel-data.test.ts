import { describe, expect, test } from 'bun:test'

import { analyzeMatch } from '@/analysis/analyze'
import { parseRcgText } from '@/rcg/parser'
import { PlayerState } from '@/rcg/types'
import { rcgText, showLine } from '@/test/rcg-builder'

import { comparisonRows, filterParams, staminaSeries } from './panel-data'

const STILL = [0, 0, 0, 0] as const

const match = parseRcgText(
  rcgText(
    '(playmode 0 play_on)',
    '(server_param (simulator_step 100) (stamina_max 8000) (ball_decay 0.94))',
    ...[8000, 7000, 6000, 5000].map((stamina, i) =>
      showLine(i + 1, [...STILL], [{ side: 'l', unum: 2, x: i, y: 0, stamina }]),
    ),
  ),
)

describe('panel data', () => {
  test('compares the teams with possession first and formatted distance', () => {
    const rows = comparisonRows(analyzeMatch(match))
    expect(rows[0]?.label).toBe('Posse')
    const run = rows.find((each) => each.label === 'Distância')
    expect(run?.text.l).toBe('3 m')
    expect(rows.find((each) => each.label === 'Passes certos')?.text.r).toBe('0/0')
  })

  test('counts every touch of the ball, not just kicks', () => {
    const tackled = parseRcgText(
      rcgText(
        '(playmode 0 play_on)',
        showLine(1, [...STILL], [{ side: 'r', unum: 4, x: 0, y: 0, counts: { tackle: 0 } }]),
        showLine(
          2,
          [...STILL],
          [
            {
              side: 'r',
              unum: 4,
              x: 0,
              y: 0,
              state: PlayerState.STAND | PlayerState.TACKLE,
              counts: { tackle: 1 },
            },
          ],
        ),
      ),
    )
    const rows = comparisonRows(analyzeMatch(tackled))
    expect(rows.find((each) => each.label === 'Toques na bola')?.r).toBe(1)
  })

  test('thins the stamina series and skips empty slots', () => {
    expect(staminaSeries(match, 1, 2).values).toEqual([8000, 6000])
    expect(staminaSeries(match, 0, 10).values).toEqual([])
  })

  test('filters and sorts parameters by name', () => {
    expect(filterParams(match.serverParams, 'STEP')).toEqual([
      { name: 'simulator_step', value: '100' },
    ])
    expect(filterParams(match.serverParams, '').map((each) => each.name)).toEqual([
      'ball_decay',
      'simulator_step',
      'stamina_max',
    ])
  })
})
