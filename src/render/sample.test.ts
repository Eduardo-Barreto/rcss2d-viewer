import { describe, expect, test } from 'bun:test'

import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { ballAt, posesAt } from './sample'

const match = parseRcgText(
  rcgText(
    showLine(1, [0, 0, 1, 0], [{ side: 'l', unum: 1, x: 0, y: 0 }]),
    showLine(2, [1, 0, 0.9, 0], [{ side: 'l', unum: 1, x: 1, y: 2 }]),
    showLine(3, [-20, 5, 0, 0], [{ side: 'l', unum: 1, x: -30, y: 2 }]),
  ),
)

describe('sample', () => {
  test('glides the ball and players between two frames', () => {
    expect(ballAt(match, 0.5)).toMatchObject({ x: 0.5, y: 0 })
    const [pose] = posesAt(match, 0.25)
    expect(pose).toMatchObject({ slot: 0, x: 0.25, y: 0.5 })
  })

  test('jumps instead of gliding across a long move', () => {
    expect(ballAt(match, 1.5)).toMatchObject({ x: 1, y: 0 })
    expect(posesAt(match, 1.5)[0]).toMatchObject({ x: 1, y: 2 })
  })

  test('clamps to the first and last frames and skips empty slots', () => {
    expect(ballAt(match, -3).x).toBe(0)
    expect(ballAt(match, 99).x).toBe(-20)
    expect(posesAt(match, 0)).toHaveLength(1)
  })

  test('uses the columns of the nearest frame for fields that do not glide', () => {
    expect(posesAt(match, 0.4)[0]?.k).toBe(0)
    expect(posesAt(match, 0.6)[0]?.k).toBe(22)
  })
})

describe('angles', () => {
  test('turn the short way across ±180', () => {
    const wrap = parseRcgText(
      rcgText(
        showLine(1, [0, 0, 0, 0], [{ side: 'r', unum: 2, x: 0, y: 0, body: 170 }]),
        showLine(2, [0, 0, 0, 0], [{ side: 'r', unum: 2, x: 0, y: 0, body: -170 }]),
      ),
    )
    const [pose] = posesAt(wrap, 0.5)
    expect(pose?.slot).toBe(12)
    expect(pose?.body).toBeCloseTo(180)
  })
})
