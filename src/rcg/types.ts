/** Team side as the server writes it. */
export type Side = 'l' | 'r'

/** Players per team on the field. */
export const PLAYERS_PER_SIDE = 11

/** Player slots per frame: left 1..11 then right 1..11. */
export const SLOT_COUNT = PLAYERS_PER_SIDE * 2

/** Floats per ball entry in {@link FrameColumns.ball}: x, y, vx, vy. */
export const BALL_STRIDE = 4

/**
 * Command counters in the `(c ...)` group, in the order of
 * `SerializerMonitorStdv5::serializePlayerCounts` (rcssserver `src/serializermonitor.cpp:390`).
 * Logs before v6 stop at `attentionto`.
 */
export const COUNTERS = [
  'kick',
  'dash',
  'turn',
  'catch',
  'move',
  'turnNeck',
  'changeView',
  'say',
  'tackle',
  'pointto',
  'attentionto',
  'changeFocus',
] as const

/** One command counter name. */
export type Counter = (typeof COUNTERS)[number]

/** Index of each counter inside a slot's block of {@link FrameColumns.counts}. */
export const COUNTER_INDEX: Readonly<Record<Counter, number>> = {
  kick: 0,
  dash: 1,
  turn: 2,
  catch: 3,
  move: 4,
  turnNeck: 5,
  changeView: 6,
  say: 7,
  tackle: 8,
  pointto: 9,
  attentionto: 10,
  changeFocus: 11,
}

/** Player state bits from rcssserver `src/types.h:47`. */
export const PlayerState = {
  STAND: 0x1,
  KICK: 0x2,
  KICK_FAULT: 0x4,
  GOALIE: 0x8,
  CATCH: 0x10,
  CATCH_FAULT: 0x20,
  BALL_TO_PLAYER: 0x40,
  PLAYER_TO_BALL: 0x80,
  DISCARD: 0x100,
  LOST: 0x200,
  BALL_COLLIDE: 0x400,
  PLAYER_COLLIDE: 0x800,
  TACKLE: 0x1000,
  TACKLE_FAULT: 0x2000,
  BACK_PASS: 0x4000,
  FREE_KICK_FAULT: 0x8000,
  POST_COLLIDE: 0x10000,
  FOUL_CHARGED: 0x20000,
  YELLOW_CARD: 0x40000,
  RED_CARD: 0x80000,
  ILLEGAL_DEFENSE: 0x100000,
} as const

/** Per-slot float fields, each a column of `count * SLOT_COUNT` values. */
export const SLOT_FLOATS = [
  'x',
  'y',
  'vx',
  'vy',
  'body',
  'neck',
  'pointX',
  'pointY',
  'viewWidth',
  'focusDist',
  'focusDir',
  'stamina',
  'effort',
  'recovery',
  'capacity',
] as const

/** One per-slot float field name. */
export type SlotFloat = (typeof SLOT_FLOATS)[number]

/**
 * Every `(show ...)` line as columns, so a whole match stays a handful of typed arrays that
 * move to the main thread without copying. Player field `f` of slot `s` in frame `i` lives at
 * `players.f[i * SLOT_COUNT + s]`. A slot with `type[k] === -1` had no player in that frame.
 */
export interface FrameColumns {
  count: number
  /** Server cycle of each frame. Cycles repeat while the clock is stopped. */
  cycle: Int32Array
  /** Play mode id in force at each frame, see `PLAYMODES`. */
  playmode: Uint8Array
  scoreLeft: Uint16Array
  scoreRight: Uint16Array
  /** x, y, vx, vy of the ball per frame. */
  ball: Float32Array
  players: Record<SlotFloat, Float32Array>
  /** Player type id, -1 when the slot is empty. */
  type: Int8Array
  state: Uint32Array
  /** 1 for high view quality. */
  viewHigh: Uint8Array
  /** Slot the player is attending to, -1 for none. */
  focusTarget: Int8Array
  /** `COUNTERS.length` counters per slot per frame. */
  counts: Uint32Array
}

/** A value from a `(name value)` parameter pair. */
type ParamValue = number | string

/** A parameter block. A `Map` so names read from the log never touch an object prototype. */
export type ParamMap = Map<string, ParamValue>

/** A change of play mode, attached to the first frame it applies to. */
export interface PlayModeChange {
  frame: number
  cycle: number
  mode: number
}

/** A `(team ...)` line: names and the score from that frame on. */
export interface ScoreChange {
  frame: number
  cycle: number
  left: number
  right: number
  penaltiesLeft: number
  penaltiesRight: number
  penaltyMissesLeft: number
  penaltyMissesRight: number
}

/** A `(msg ...)` line that is not a team graphic. */
export interface LogMessage {
  frame: number
  cycle: number
  /** 1 is MSG_BOARD, 2 is LOG_BOARD. */
  board: number
  text: string
}

/** An 8x8 (usually) tile of a team logo, already decoded to RGBA. */
export interface GraphicTile {
  x: number
  y: number
  width: number
  height: number
  rgba: Uint8ClampedArray
}

/** Everything the viewer knows about one match. */
export interface Match {
  version: number
  leftName: string
  rightName: string
  frames: FrameColumns
  playmodes: PlayModeChange[]
  scores: ScoreChange[]
  messages: LogMessage[]
  graphics: Record<Side, GraphicTile[]>
  serverParams: ParamMap
  playerParams: ParamMap
  playerTypes: ParamMap[]
  /**
   * Lines skipped: unknown type, past the message or event cap, or a last line cut short. Kept
   * so the UI can say so.
   */
  skippedLines: number
}
