import type { Match, ParamMap } from '@/rcg/types'

/** Pitch length in meters. Field constants follow rcssserver `src/serverparam.cpp:132`. */
export const PITCH_LENGTH = 105
/** Pitch width in meters, `PITCH_WIDTH`. */
export const PITCH_WIDTH = 68
/** Penalty area depth, `PENALTY_AREA_LENGTH`. */
export const PENALTY_AREA_LENGTH = 16.5
/** Penalty area width, `PENALTY_AREA_WIDTH`. */
export const PENALTY_AREA_WIDTH = 40.32
/** Goal area depth, `GOAL_AREA_LENGTH`. */
export const GOAL_AREA_LENGTH = 5.5
/** Goal area width, `GOAL_AREA_WIDTH`. */
export const GOAL_AREA_WIDTH = 18.32
/** Center circle radius, `CENTER_CIRCLE_R`. */
export const CENTER_CIRCLE_RADIUS = 9.15
/** Penalty spot distance from the goal line, `PENALTY_SPOT_DIST`. */
export const PENALTY_SPOT_DISTANCE = 11
/** Goal depth drawn behind the line, `GOAL_DEPTH`. */
export const GOAL_DEPTH = 2.44

const DEFAULT_GOAL_WIDTH = 14.02
const DEFAULT_BALL_DECAY = 0.94
const DEFAULT_BALL_SIZE = 0.085
const DEFAULT_PLAYER_SIZE = 0.3
const DEFAULT_KICKABLE_MARGIN = 0.7
const DEFAULT_STAMINA_MAX = 8000
const DEFAULT_HALF_TIME = 300
const DEFAULT_EXTRA_HALF_TIME = 100
const DEFAULT_NORMAL_HALVES = 2
const DEFAULT_EXTRA_HALVES = 2
const DEFAULT_STEP_MS = 100
const DEFAULT_SLOW_DOWN = 1
const MS_PER_SECOND = 1000
const ROUNDING = 0.5
const MAX_SIZE = 5
const MAX_STEP_MS = 10_000
const MAX_STAMINA = 1_000_000
const MAX_HALVES = 64
const MAX_PLAYER_TYPE_ID = 127

type Check = (value: number) => boolean

const fraction: Check = (value) => value > 0 && value < 1
const upTo =
  (max: number): Check =>
  (value) =>
    value > 0 && value <= max
const count: Check = (value) => Number.isInteger(value) && value >= 0 && value <= MAX_HALVES

/**
 * A numeric parameter, or `fallback` when it is missing, not a number or outside the range
 * `valid` accepts. The log is untrusted: a zero `simulator_step` or a `ball_decay` of 1 would
 * divide by zero downstream.
 */
function numberParam(
  params: ParamMap | undefined,
  name: string,
  fallback: number,
  valid: Check,
): number {
  const value = params?.get(name)
  return typeof value === 'number' && Number.isFinite(value) && valid(value) ? value : fallback
}

/** The physical constants the analysis and the renderer need, with the server defaults. */
export interface Physics {
  goalWidth: number
  ballDecay: number
  ballSize: number
  playerSize: number
  /** Kickable margin by player type id; missing ids hold the `server_param` value. */
  kickableMargins: number[]
  staminaMax: number
  /** Milliseconds per cycle, `simulator_step`. */
  stepMs: number
  /**
   * Cycles in one half, `half_time` scaled as in `ServerParam::setHalfTime`
   * (rcssserver `src/serverparam.cpp:1015`). 0 when the log turns the clock off.
   */
  halfCycles: number
  /** Cycles in one extra-time half, `extra_half_time` scaled the same way. */
  extraHalfCycles: number
  /** `nr_normal_halfs`. */
  normalHalves: number
  /** `nr_extra_halfs`. */
  extraHalves: number
}

function scaledCycles(seconds: number, stepMs: number, slowDown: number): number {
  return Math.floor((seconds * MS_PER_SECOND * slowDown) / stepMs + ROUNDING)
}

function kickableMargins(match: Match, fallback: number): number[] {
  const margins: number[] = []
  for (const type of match.playerTypes) {
    const id = numberParam(type, 'id', -1, (value) => Number.isInteger(value) && value >= 0)
    if (id < 0 || id > MAX_PLAYER_TYPE_ID) continue
    while (margins.length < id) margins.push(fallback)
    margins[id] = numberParam(
      type,
      'kickable_margin',
      fallback,
      (value) => value >= 0 && value <= MAX_SIZE,
    )
  }
  return margins
}

/** Reads {@link Physics} from the log's parameter lines. */
export function physicsOf(match: Match): Physics {
  const server = match.serverParams
  const fallbackMargin = numberParam(
    server,
    'kickable_margin',
    DEFAULT_KICKABLE_MARGIN,
    (value) => value >= 0 && value <= MAX_SIZE,
  )
  const stepMs = numberParam(server, 'simulator_step', DEFAULT_STEP_MS, upTo(MAX_STEP_MS))
  const slowDown = numberParam(server, 'slow_down_factor', DEFAULT_SLOW_DOWN, upTo(MAX_HALVES))
  // A half_time of zero or less is valid: the referee then never ends a half (src/referee.cpp:506).
  const halfSeconds = numberParam(server, 'half_time', DEFAULT_HALF_TIME, () => true)
  const extraSeconds = numberParam(
    server,
    'extra_half_time',
    DEFAULT_EXTRA_HALF_TIME,
    (value) => value >= 0,
  )
  return {
    goalWidth: numberParam(server, 'goal_width', DEFAULT_GOAL_WIDTH, upTo(PITCH_WIDTH)),
    ballDecay: numberParam(server, 'ball_decay', DEFAULT_BALL_DECAY, fraction),
    ballSize: numberParam(server, 'ball_size', DEFAULT_BALL_SIZE, upTo(MAX_SIZE)),
    playerSize: numberParam(server, 'player_size', DEFAULT_PLAYER_SIZE, upTo(MAX_SIZE)),
    kickableMargins: kickableMargins(match, fallbackMargin),
    staminaMax: numberParam(server, 'stamina_max', DEFAULT_STAMINA_MAX, upTo(MAX_STAMINA)),
    stepMs,
    halfCycles: halfSeconds > 0 ? Math.max(1, scaledCycles(halfSeconds, stepMs, slowDown)) : 0,
    extraHalfCycles: scaledCycles(extraSeconds, stepMs, slowDown),
    normalHalves: numberParam(server, 'nr_normal_halfs', DEFAULT_NORMAL_HALVES, count),
    extraHalves: numberParam(server, 'nr_extra_halfs', DEFAULT_EXTRA_HALVES, count),
  }
}

/**
 * Cycles where a half ends, before `lastCycle`: every `half_time` up to the normal halves, then
 * every `extra_half_time`, as `TimeRef::analyse` calls half time (rcssserver
 * `src/referee.cpp:507-585`). Extra time only shows when the log runs into it.
 */
export function halfEnds(physics: Physics, lastCycle: number): number[] {
  const ends: number[] = []
  if (physics.halfCycles <= 0) return ends
  const normal = physics.halfCycles * physics.normalHalves
  for (let half = 1; half <= physics.normalHalves; half++) ends.push(physics.halfCycles * half)
  if (physics.extraHalfCycles > 0) {
    for (let half = 1; half <= physics.extraHalves; half++) {
      ends.push(normal + physics.extraHalfCycles * half)
    }
  }
  return ends.filter((cycle) => cycle < lastCycle)
}
