import { PLAY_ON } from '@/rcg/playmodes'
import { type Match, SLOT_COUNT, type Side } from '@/rcg/types'

import { type MatchEvent, type EventKind } from './events'
import { type Pass, type Shot, isTouch } from './touches'

/** Totals for one player or one team. */
export interface Tally {
  /** Kicks, won tackles, catches and punches: every time the player moved the ball. */
  touches: number
  kicks: number
  passes: number
  passesComplete: number
  shots: number
  shotsOnTarget: number
  goals: number
  tackles: number
  tacklesMissed: number
  catches: number
  /** Catches that failed and punched the ball away instead. */
  punches: number
  /** Fouls suffered: the player was frozen by an opponent's foul tackle. */
  fouled: number
  yellow: number
  red: number
  /** Meters run, without teleports from `move`. */
  distance: number
}

/** Who scored each goal, if a kick can be credited. */
export interface Goal {
  frame: number
  side: Side
  /** Slot of the last kicker of the scoring side, -1 if none. */
  scorer: number
  /** True when the last touch before the goal was by the conceding side. */
  ownGoal: boolean
}

const EVENT_FIELD: Partial<Record<EventKind, keyof Tally>> = {
  kick: 'kicks',
  tackle: 'tackles',
  tackleMiss: 'tacklesMissed',
  catch: 'catches',
  punch: 'punches',
  fouled: 'fouled',
  yellow: 'yellow',
  red: 'red',
}

const TALLY_FIELDS: readonly (keyof Tally)[] = [
  'touches',
  'kicks',
  'passes',
  'passesComplete',
  'shots',
  'shotsOnTarget',
  'goals',
  'tackles',
  'tacklesMissed',
  'catches',
  'punches',
  'fouled',
  'yellow',
  'red',
  'distance',
]

/** A tally with every field at zero. */
function emptyTally(): Tally {
  return {
    touches: 0,
    kicks: 0,
    passes: 0,
    passesComplete: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    tackles: 0,
    tacklesMissed: 0,
    catches: 0,
    punches: 0,
    fouled: 0,
    yellow: 0,
    red: 0,
    distance: 0,
  }
}

/** Largest step in meters still counted as running; a player dashes about 1 m per cycle. */
const MAX_RUN_STEP = 2

/** Meters run by each slot. Only `play_on` frames count, so `move` before kick-offs does not. */
export function distanceBySlot(match: Match): Float64Array {
  const f = match.frames
  const out = new Float64Array(SLOT_COUNT)
  for (let frame = 1; frame < f.count; frame++) {
    if (f.playmode[frame] !== PLAY_ON) continue
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const k = frame * SLOT_COUNT + slot
      const step = Math.hypot(
        (f.players.x[k] ?? 0) - (f.players.x[k - SLOT_COUNT] ?? 0),
        (f.players.y[k] ?? 0) - (f.players.y[k - SLOT_COUNT] ?? 0),
      )
      if (step < MAX_RUN_STEP) out[slot] = (out[slot] ?? 0) + step
    }
  }
  return out
}

/** Credits each goal to the last kick before it. */
export function creditGoals(events: MatchEvent[]): Goal[] {
  const goals: Goal[] = []
  let lastKick: MatchEvent | null = null
  for (const event of events) {
    if (event.kind === 'kick') lastKick = event
    if (event.kind !== 'goal' || event.side === null) continue
    const ownGoal = lastKick !== null && lastKick.side !== event.side
    const scorer = lastKick === null || ownGoal ? -1 : lastKick.slot
    goals.push({ frame: event.frame, side: event.side, scorer, ownGoal })
    lastKick = null
  }
  return goals
}

interface TallyInput {
  events: MatchEvent[]
  passes: Pass[]
  shots: Shot[]
  goals: Goal[]
  distance: Float64Array
}

function bump(tallies: Tally[], slot: number, field: keyof Tally): void {
  const tally = tallies[slot]
  if (tally !== undefined) tally[field]++
}

/** One tally per slot. */
export function tallyBySlot({ events, passes, shots, goals, distance }: TallyInput): Tally[] {
  const tallies = Array.from({ length: SLOT_COUNT }, emptyTally)
  for (const event of events) {
    const field = EVENT_FIELD[event.kind]
    if (field !== undefined) bump(tallies, event.slot, field)
    if (isTouch(event.kind)) bump(tallies, event.slot, 'touches')
  }
  for (const pass of passes) {
    if (pass.outcome === 'kept') continue
    bump(tallies, pass.from, 'passes')
    if (pass.outcome === 'complete') bump(tallies, pass.from, 'passesComplete')
  }
  for (const shot of shots) {
    bump(tallies, shot.slot, 'shots')
    if (shot.onTarget) bump(tallies, shot.slot, 'shotsOnTarget')
  }
  for (const goal of goals) bump(tallies, goal.scorer, 'goals')
  tallies.forEach((tally, slot) => {
    tally.distance = distance[slot] ?? 0
  })
  return tallies
}

/** Sum of the tallies of `slots`. */
export function sumTallies(tallies: Tally[], slots: number[]): Tally {
  const total = emptyTally()
  for (const slot of slots) {
    const tally = tallies[slot]
    if (tally === undefined) continue
    for (const field of TALLY_FIELDS) total[field] += tally[field]
  }
  return total
}
