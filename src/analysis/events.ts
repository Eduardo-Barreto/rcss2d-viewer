import { PLAYMODES, playModeId, playModeSide } from '@/rcg/playmodes'
import {
  COUNTERS,
  COUNTER_INDEX,
  type Match,
  PLAYERS_PER_SIDE,
  PlayerState,
  SLOT_COUNT,
  type Side,
} from '@/rcg/types'

/** What happened in a {@link MatchEvent}. */
export type EventKind =
  | 'goal'
  | 'kick'
  | 'tackle'
  | 'tackleMiss'
  | 'catch'
  | 'punch'
  | 'fouled'
  | 'yellow'
  | 'red'
  | 'playmode'

/** One thing that happened at a frame, read from counters, state flags and referee lines. */
export interface MatchEvent {
  frame: number
  cycle: number
  kind: EventKind
  /** Player slot, -1 when no player is involved. */
  slot: number
  /** Team the event counts for: the scorer, the kicker, the team awarded a set piece. */
  side: Side | null
  /** Play mode id, for `playmode` and `goal`. */
  mode: number
}

/** Side of a player slot. */
export function sideOfSlot(slot: number): Side {
  return slot < PLAYERS_PER_SIDE ? 'l' : 'r'
}

/** Shirt number of a player slot. */
export function unumOfSlot(slot: number): number {
  return (slot % PLAYERS_PER_SIDE) + 1
}

const CHANGES_SHOWN = new Set<string>([
  'kick_off',
  'kick_in',
  'corner_kick',
  'goal_kick',
  'free_kick',
  'offside',
  'foul_charge',
  'back_pass',
  'free_kick_fault',
  'indirect_free_kick',
  'illegal_defense',
  'penalty_setup',
  'penalty_score',
  'penalty_miss',
  'time_over',
  'first_half_over',
])

/** True when a play mode change is worth a marker: set pieces, fouls and the end of halves. */
function shownMode(mode: number): boolean {
  const name = PLAYMODES[mode] ?? ''
  return CHANGES_SHOWN.has(name.replace(/_[lr]$/, ''))
}

function rising(prev: number, next: number, bit: number): boolean {
  return (prev & bit) === 0 && (next & bit) !== 0
}

function counterDelta(match: Match, prevK: number, k: number, counter: number): number {
  const { counts } = match.frames
  const width = COUNTERS.length
  return (counts[k * width + counter] ?? 0) - (counts[prevK * width + counter] ?? 0)
}

interface SlotStep {
  match: Match
  frame: number
  slot: number
  out: MatchEvent[]
}

function push(step: SlotStep, kind: EventKind): void {
  const { match, frame, slot } = step
  const side = sideOfSlot(slot)
  const other: Side = side === 'l' ? 'r' : 'l'
  const credited = kind === 'fouled' ? other : side
  step.out.push({
    frame,
    cycle: match.frames.cycle[frame] ?? 0,
    kind,
    slot,
    side: credited,
    mode: -1,
  })
}

/**
 * Play modes where a successful tackle returns before it reaches the ball
 * (rcssserver `src/player.cpp:2127-2145`).
 */
const TACKLE_DEAD_MODES = new Set(
  [
    'before_kick_off',
    'goal_l',
    'goal_r',
    'offside_l',
    'offside_r',
    'illegal_defense_l',
    'illegal_defense_r',
    'foul_charge_l',
    'foul_charge_r',
    'foul_push_l',
    'foul_push_r',
    'back_pass_l',
    'back_pass_r',
    'free_kick_fault_l',
    'free_kick_fault_r',
    'time_over',
  ].map((name) => playModeId(name)),
)

/**
 * A tackle that took the ball, or `tackleMiss`. `TACKLE_FAULT` marks one that missed; one in a
 * stopped mode never reaches the ball. The command ran under the previous frame's mode.
 */
function tackleKind(step: SlotStep, state: number): EventKind {
  if ((state & PlayerState.TACKLE_FAULT) !== 0) return 'tackleMiss'
  const mode = step.match.frames.playmode[step.frame - 1] ?? 0
  return TACKLE_DEAD_MODES.has(mode) ? 'tackleMiss' : 'tackle'
}

/**
 * Commands that ran between two frames, from the `(c ...)` counters. The server bumps the kick
 * counter only when the kick reached the ball (rcssserver `Player::kick`, `src/player.cpp:1416`,
 * and `Player::doLongKick`, `src/player.cpp:1519`) and the tackle counter on every try
 * (`src/player.cpp:2079`). The catch counter goes up only past the reach checks
 * (`src/player.cpp:1699`); with `CATCH_FAULT` set it was a probabilistic failure and the goalie
 * punched the ball (`Stadium::ballPunched`, `src/player.cpp:1696`).
 */
function commandEvents(step: SlotStep, prevK: number, k: number): void {
  const state = step.match.frames.state[k] ?? 0
  if (counterDelta(step.match, prevK, k, COUNTER_INDEX.kick) > 0) push(step, 'kick')
  if (counterDelta(step.match, prevK, k, COUNTER_INDEX.tackle) > 0) {
    push(step, tackleKind(step, state))
  }
  if (counterDelta(step.match, prevK, k, COUNTER_INDEX.catch) > 0) {
    push(step, (state & PlayerState.CATCH_FAULT) === 0 ? 'catch' : 'punch')
  }
}

/**
 * Referee flags that switch on. `FOUL_CHARGED` is set on the player who was fouled
 * (`src/referee.cpp:835`); cards are set on the offender (`src/player.cpp:2806`).
 */
function flagEvents(step: SlotStep, prev: number, next: number): void {
  if (rising(prev, next, PlayerState.FOUL_CHARGED)) push(step, 'fouled')
  if (rising(prev, next, PlayerState.YELLOW_CARD)) push(step, 'yellow')
  if (rising(prev, next, PlayerState.RED_CARD)) push(step, 'red')
}

function playerEvents(match: Match, out: MatchEvent[]): void {
  const f = match.frames
  for (let frame = 1; frame < f.count; frame++) {
    for (let slot = 0; slot < SLOT_COUNT; slot++) {
      const k = frame * SLOT_COUNT + slot
      const prevK = k - SLOT_COUNT
      if ((f.type[k] ?? -1) < 0 || (f.type[prevK] ?? -1) < 0) continue
      const step = { match, frame, slot, out }
      commandEvents(step, prevK, k)
      flagEvents(step, f.state[prevK] ?? 0, f.state[k] ?? 0)
    }
  }
}

function refereeEvents(match: Match, out: MatchEvent[]): void {
  let left = 0
  let right = 0
  for (const change of match.scores) {
    if (change.left > left || change.right > right) {
      const side = change.left > left ? 'l' : 'r'
      out.push({ frame: change.frame, cycle: change.cycle, kind: 'goal', slot: -1, side, mode: -1 })
    }
    left = change.left
    right = change.right
  }
  for (const change of match.playmodes) {
    if (!shownMode(change.mode)) continue
    const side = playModeSide(change.mode)
    out.push({ ...change, kind: 'playmode', slot: -1, side, mode: change.mode })
  }
}

/** Every event of a match, in frame order. */
export function findEvents(match: Match): MatchEvent[] {
  const out: MatchEvent[] = []
  playerEvents(match, out)
  refereeEvents(match, out)
  return out.toSorted((a, b) => a.frame - b.frame)
}
