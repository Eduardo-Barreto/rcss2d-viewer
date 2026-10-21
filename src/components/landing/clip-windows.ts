import { frameOfCycle } from '@/player/format'
import type { Match } from '@/rcg/types'

/** A span of frames a demo loops over, and the frame shown when motion is reduced. */
export interface FrameWindow {
  from: number
  to: number
  still: number
}

const HERO_FROM_CYCLE = 2600
const GOAL_CYCLE = 2711
const AFTER_GOAL_FRAMES = 24
const STILL_BEFORE_GOAL_FRAMES = 5

/** The frame windows of the example clip, found by cycle so a recut clip keeps working. */
export function clipWindows(match: Match): { hero: FrameWindow; whole: FrameWindow } {
  const last = Math.max(0, match.frames.count - 1)
  const goal = frameOfCycle(match, GOAL_CYCLE)
  const from = frameOfCycle(match, HERO_FROM_CYCLE)
  const to = Math.min(last, goal + AFTER_GOAL_FRAMES)
  const still = Math.max(from, goal - STILL_BEFORE_GOAL_FRAMES)
  return {
    hero: { from, to: Math.max(from, to), still },
    whole: { from: 0, to: last, still },
  }
}
