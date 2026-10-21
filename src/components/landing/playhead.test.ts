import { describe, expect, test } from 'bun:test'

import { END_HOLD_MS, nextFrame, shownFrame } from './playhead'

const SPAN = { from: 10, to: 20, still: 15 }
const STEP_MS = 100

describe('nextFrame', () => {
  test('moves one frame per server cycle of real time', () => {
    expect(nextFrame(10, 100, STEP_MS, SPAN)).toBe(11)
    expect(nextFrame(10, 50, STEP_MS, SPAN)).toBe(10.5)
  })

  test('never jumps more than one cycle after a long pause', () => {
    expect(nextFrame(10, 5000, STEP_MS, SPAN)).toBe(11)
  })

  test('holds past the end before starting over', () => {
    const holding = nextFrame(20, 100, STEP_MS, SPAN)
    expect(holding).toBe(21)
    expect(shownFrame(holding, SPAN)).toBe(20)
    expect(nextFrame(20 + END_HOLD_MS / STEP_MS, 100, STEP_MS, SPAN)).toBe(10)
  })
})

describe('shownFrame', () => {
  test('keeps the painted frame inside the span', () => {
    expect(shownFrame(4, SPAN)).toBe(10)
    expect(shownFrame(14.5, SPAN)).toBe(14.5)
  })
})
