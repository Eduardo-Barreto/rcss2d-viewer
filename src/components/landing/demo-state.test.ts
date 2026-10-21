import { describe, expect, test } from 'bun:test'

import type { Moment } from '@/player/moments'

import { LAYER_KEYS, activeMoment, layerAt, overlaysOf } from './demo-state'

function moment(frame: number, kind: Moment['kind']): Moment {
  return { frame, cycle: frame, kind, side: 'r', slot: -1, text: kind, strong: false }
}

describe('layer cycle', () => {
  test('walks every layer and starts over', () => {
    expect(LAYER_KEYS.map((_, i) => layerAt(i))).toEqual([...LAYER_KEYS])
    expect(layerAt(LAYER_KEYS.length)).toBe('trails')
  })

  test('switches exactly one overlay on', () => {
    for (const key of LAYER_KEYS) {
      const on = Object.entries(overlaysOf(key)).filter(([, value]) => value)
      expect(on).toEqual([[key, true]])
    }
  })
})

describe('activeMoment', () => {
  const moments = [moment(27, 'foul'), moment(242, 'shot'), moment(251, 'goal')]

  test('is empty before the first moment', () => {
    expect(activeMoment(moments, 10)).toBeNull()
  })

  test('stays on a moment until the next one', () => {
    expect(activeMoment(moments, 27)?.kind).toBe('foul')
    expect(activeMoment(moments, 241)?.kind).toBe('foul')
    expect(activeMoment(moments, 260)?.kind).toBe('goal')
  })
})
