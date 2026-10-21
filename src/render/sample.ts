import { BALL_STRIDE, type Match, SLOT_COUNT } from '@/rcg/types'

/** Farther than this between two frames is a `move`, drawn as a jump, not a glide. */
const MAX_GLIDE = 3
const FULL_TURN = 360
const HALF_TURN = 180
const HALF = 0.5

/** A player at a point in time between two frames. */
export interface PlayerPose {
  slot: number
  x: number
  y: number
  /** Body direction in degrees, 0 toward +x, clockwise on screen since y points down. */
  body: number
  /** Head direction relative to the body, in degrees. */
  neck: number
  /** Index into the columns of the nearest frame, for the fields that do not glide. */
  k: number
}

/** The ball between two frames. */
export interface BallPose {
  x: number
  y: number
  vx: number
  vy: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpAngle(a: number, b: number, t: number): number {
  const turn = ((((b - a) % FULL_TURN) + FULL_TURN + HALF_TURN) % FULL_TURN) - HALF_TURN
  return a + turn * t
}

function bounds(match: Match, frame: number) {
  const last = match.frames.count - 1
  const clamped = Math.min(Math.max(frame, 0), last)
  const i = Math.floor(clamped)
  return { i, j: Math.min(i + 1, last), t: clamped - i }
}

/** The ball at `frame`, which may fall between two frames. */
export function ballAt(match: Match, frame: number): BallPose {
  const { i, j, t } = bounds(match, frame)
  const b = match.frames.ball
  const [x0 = 0, y0 = 0, vx = 0, vy = 0] = b.subarray(i * BALL_STRIDE, (i + 1) * BALL_STRIDE)
  const [x1 = x0, y1 = y0] = b.subarray(j * BALL_STRIDE, (j + 1) * BALL_STRIDE)
  const s = Math.hypot(x1 - x0, y1 - y0) > MAX_GLIDE ? 0 : t
  return { x: lerp(x0, x1, s), y: lerp(y0, y1, s), vx, vy }
}

/** Glide weight between columns `a` and `b`: 0 when the player left or was moved. */
function glide(match: Match, a: number, b: number, t: number): number {
  const { players: p, type } = match.frames
  if ((type[b] ?? -1) < 0) return 0
  const dx = (p.x[b] ?? 0) - (p.x[a] ?? 0)
  const dy = (p.y[b] ?? 0) - (p.y[a] ?? 0)
  return Math.hypot(dx, dy) > MAX_GLIDE ? 0 : t
}

function poseBetween(match: Match, a: number, b: number, s: number): PlayerPose {
  const slot = a % SLOT_COUNT
  const p = match.frames.players
  const at = (column: Float32Array) => lerp(column[a] ?? 0, column[b] ?? 0, s)
  const turn = (column: Float32Array) => lerpAngle(column[a] ?? 0, column[b] ?? 0, s)
  return {
    slot,
    x: at(p.x),
    y: at(p.y),
    body: turn(p.body),
    neck: turn(p.neck),
    k: s < HALF ? a : b,
  }
}

/** Every player on the field at `frame`, which may fall between two frames. */
export function posesAt(match: Match, frame: number): PlayerPose[] {
  const { i, j, t } = bounds(match, frame)
  const { type } = match.frames
  const poses: PlayerPose[] = []
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const a = i * SLOT_COUNT + slot
    if ((type[a] ?? -1) >= 0) {
      const b = j * SLOT_COUNT + slot
      poses.push(poseBetween(match, a, b, glide(match, a, b, t)))
    }
  }
  return poses
}
