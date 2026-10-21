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
const DEFAULT_STEP_MS = 100
const MS_PER_SECOND = 1000

/** A numeric parameter, or `fallback` when it is missing or not a number. */
export function numberParam(params: ParamMap | undefined, name: string, fallback: number): number {
  const value = params?.get(name)
  return typeof value === 'number' ? value : fallback
}

/** The physical constants the analysis and the renderer need, with the server defaults. */
export interface Physics {
  goalWidth: number
  ballDecay: number
  ballSize: number
  playerSize: number
  /** Kickable margin of each player type id. */
  kickableMargins: number[]
  staminaMax: number
  /** Cycles in one half, `half_time` scaled as in `ServerParam::getHalfTimeScaler`. */
  halfCycles: number
}

/** Reads {@link Physics} from the log's parameter lines. */
export function physicsOf(match: Match): Physics {
  const server = match.serverParams
  const fallbackMargin = numberParam(server, 'kickable_margin', DEFAULT_KICKABLE_MARGIN)
  const stepMs = numberParam(server, 'simulator_step', DEFAULT_STEP_MS)
  const halfSeconds = numberParam(server, 'half_time', DEFAULT_HALF_TIME)
  return {
    goalWidth: numberParam(server, 'goal_width', DEFAULT_GOAL_WIDTH),
    ballDecay: numberParam(server, 'ball_decay', DEFAULT_BALL_DECAY),
    ballSize: numberParam(server, 'ball_size', DEFAULT_BALL_SIZE),
    playerSize: numberParam(server, 'player_size', DEFAULT_PLAYER_SIZE),
    kickableMargins: match.playerTypes.map((type) =>
      numberParam(type, 'kickable_margin', fallbackMargin),
    ),
    staminaMax: numberParam(server, 'stamina_max', DEFAULT_STAMINA_MAX),
    halfCycles: Math.max(1, Math.round((halfSeconds * MS_PER_SECOND) / stepMs)),
  }
}
