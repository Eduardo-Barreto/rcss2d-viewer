import { describe, expect, test } from 'bun:test'

import { clipLog } from './clip-rcg.ts'

const LOG = [
  'ULG6',
  '(server_param (goal_width 14.02))',
  '(player_type (id 0))',
  '(msg 0 1 "(team_graphic_l (0 0 ...))")',
  '(playmode 1 kick_off_l)',
  '(team 1 A B 0 0)',
  '(show 1 ((b) 0 0 0 0))',
  '(playmode 2 play_on)',
  '(show 2 ((b) 1 0 0 0))',
  '(team 2 A B 1 0)',
  '(show 3 ((b) 2 0 0 0))',
  '(show 4 ((b) 3 0 0 0))',
  '(show 5 ((b) 4 0 0 0))',
].join('\n')

describe('clipLog', () => {
  test('keeps the header and the cycle-0 messages', () => {
    const lines = clipLog(LOG, 3, 4).split('\n')

    expect(lines.slice(0, 4)).toEqual([
      'ULG6',
      '(server_param (goal_width 14.02))',
      '(player_type (id 0))',
      '(msg 0 1 "(team_graphic_l (0 0 ...))")',
    ])
  })

  test('carries the play mode and score in force before the range', () => {
    const lines = clipLog(LOG, 3, 4).split('\n')

    expect(lines.slice(4)).toEqual([
      '(playmode 2 play_on)',
      '(team 2 A B 1 0)',
      '(show 3 ((b) 2 0 0 0))',
      '(show 4 ((b) 3 0 0 0))',
      '',
    ])
  })

  test('drops every line after the range', () => {
    expect(clipLog(LOG, 1, 2)).not.toContain('(show 3 ')
  })

  test('refuses a range with nothing in it', () => {
    expect(() => clipLog(LOG, 9, 12)).toThrow(RangeError)
  })

  test('refuses a reversed range', () => {
    expect(() => clipLog(LOG, 4, 3)).toThrow(RangeError)
  })
})
