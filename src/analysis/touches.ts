import { PLAY_ON } from '@/rcg/playmodes'
import { BALL_STRIDE, type Match, type Side } from '@/rcg/types'

import { type MatchEvent, sideOfSlot } from './events'
import { PITCH_LENGTH, type Physics } from './params'

/** A touch of the ball: a kick, a tackle that won it or a catch. */
export interface Touch {
  frame: number
  slot: number
  side: Side
  kind: 'kick' | 'tackle' | 'catch'
}

/** How a kick ended: at a teammate, at an opponent, with the play stopped, or kept. */
export type PassOutcome = 'complete' | 'lost' | 'stopped' | 'kept'

/** A kick and who touched the ball next. */
export interface Pass {
  frame: number
  from: number
  /** Slot of the next touch, -1 when the play stopped first. */
  to: number
  side: Side
  outcome: PassOutcome
}

/** A kick headed for the opponent goal line close enough to the goal. */
export interface Shot {
  frame: number
  slot: number
  side: Side
  /** Where the ball would cross the goal line if nobody touched it. */
  crossY: number
  onTarget: boolean
}

const TOUCH_KINDS = new Set(['kick', 'tackle', 'catch'])
/** Meters wide of the posts a kick still counts as a shot. */
const SHOT_MARGIN = 3
const HALF = 0.5

/** Kicks, won tackles and catches, in order. */
export function touchesOf(events: MatchEvent[]): Touch[] {
  const touches: Touch[] = []
  for (const event of events) {
    if (!TOUCH_KINDS.has(event.kind) || event.slot < 0) continue
    const kind = event.kind === 'kick' || event.kind === 'tackle' ? event.kind : 'catch'
    touches.push({ frame: event.frame, slot: event.slot, side: sideOfSlot(event.slot), kind })
  }
  return touches
}

/** Frames where the play stopped, in order. */
function stopFrames(match: Match): number[] {
  return match.playmodes.filter((change) => change.mode !== PLAY_ON).map((change) => change.frame)
}

function firstAfter(sorted: number[], frame: number): number {
  return sorted.find((value) => value > frame) ?? Number.POSITIVE_INFINITY
}

function outcomeOf(touch: Touch, next: Touch | undefined, stop: number): PassOutcome {
  if (next === undefined || next.frame >= stop) return 'stopped'
  if (next.slot === touch.slot) return 'kept'
  return next.side === touch.side ? 'complete' : 'lost'
}

/** Every kick paired with the next touch. A kick by the same player again is a dribble. */
export function passesOf(match: Match, touches: Touch[]): Pass[] {
  const stops = stopFrames(match)
  const passes: Pass[] = []
  touches.forEach((touch, i) => {
    if (touch.kind !== 'kick') return
    const next = touches[i + 1]
    const outcome = outcomeOf(touch, next, firstAfter(stops, touch.frame))
    const to = outcome === 'stopped' ? -1 : (next?.slot ?? -1)
    passes.push({ frame: touch.frame, from: touch.slot, to, side: touch.side, outcome })
  })
  return passes
}

/**
 * Where a ball would cross the goal line it is heading to, rolling free. With decay `d` a ball
 * at speed `v` covers at most `v / (1 - d)` (rcssserver `MPObject::_inc`, `src/object.cpp:623`, applies `ball_decay` each
 * cycle), so a kick too weak to arrive returns `null`.
 */
export function crossingY(
  match: Match,
  frame: number,
  side: Side,
  physics: Physics,
): number | null {
  const at = frame * BALL_STRIDE
  const { ball } = match.frames
  const [x = 0, y = 0, vx = 0, vy = 0] = ball.subarray(at, at + BALL_STRIDE)
  const goalX = side === 'l' ? PITCH_LENGTH * HALF : -PITCH_LENGTH * HALF
  const towards = (goalX - x) * vx
  if (towards <= 0) return null
  const reach = Math.abs(vx) / (1 - physics.ballDecay)
  if (reach < Math.abs(goalX - x)) return null
  return y + (vy * (goalX - x)) / vx
}

/** Frames apart that two shooting kicks by one player still count as one shot. */
const SHOT_MERGE_FRAMES = 3

/**
 * Kicks headed for the goal they attack within {@link SHOT_MARGIN} of a post. A player who
 * kicks a few times in a row toward goal, as a dribble that ends in a shot, takes one shot: the
 * last kick.
 */
export function shotsOf(match: Match, touches: Touch[], physics: Physics): Shot[] {
  const halfGoal = physics.goalWidth * HALF
  const shots: Shot[] = []
  for (const touch of touches) {
    if (touch.kind !== 'kick') continue
    const crossY = crossingY(match, touch.frame, touch.side, physics)
    if (crossY === null || Math.abs(crossY) > halfGoal + SHOT_MARGIN) continue
    const previous = shots.at(-1)
    if (previous?.slot === touch.slot && touch.frame - previous.frame <= SHOT_MERGE_FRAMES) {
      shots.pop()
    }
    const onTarget = Math.abs(crossY) <= halfGoal
    shots.push({ frame: touch.frame, slot: touch.slot, side: touch.side, crossY, onTarget })
  }
  return shots
}

/** Ball owner per frame, from the last touch: 0 left, 1 right, -1 nobody yet. */
export function ownerByFrame(match: Match, touches: Touch[]): Int8Array {
  const owner = new Int8Array(match.frames.count).fill(-1)
  let current = -1
  let next = 0
  for (let frame = 0; frame < owner.length; frame++) {
    while (next < touches.length && (touches[next]?.frame ?? 0) <= frame) {
      current = touches[next]?.side === 'l' ? 0 : 1
      next++
    }
    owner[frame] = current
  }
  return owner
}
