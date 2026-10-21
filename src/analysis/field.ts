import { PLAY_ON } from '@/rcg/playmodes'
import {
  BALL_STRIDE,
  type Match,
  PLAYERS_PER_SIDE,
  PlayerState,
  SLOT_COUNT,
  type Side,
} from '@/rcg/types'

import { PITCH_LENGTH, PITCH_WIDTH } from './params'

const HALF = 0.5

/** A grid of counts over the pitch, row-major from the top-left corner (-52.5, -34). */
export interface Heatmap {
  cols: number
  rows: number
  cells: Float32Array
  /** Largest cell, for scaling. */
  peak: number
}

function binOf(x: number, y: number, cols: number, rows: number): number {
  const col = Math.floor(((x + PITCH_LENGTH * HALF) / PITCH_LENGTH) * cols)
  const row = Math.floor(((y + PITCH_WIDTH * HALF) / PITCH_WIDTH) * rows)
  const c = Math.min(cols - 1, Math.max(0, col))
  const r = Math.min(rows - 1, Math.max(0, row))
  return r * cols + c
}

/** The grid size and which positions to count. */
export interface HeatmapQuery {
  cols: number
  rows: number
  /** Player slots, or `'ball'`. */
  subject: number[] | 'ball'
}

function countFrame(match: Match, frame: number, subject: number[] | 'ball', add: Add): void {
  const f = match.frames
  if (subject === 'ball') {
    add(f.ball[frame * BALL_STRIDE] ?? 0, f.ball[frame * BALL_STRIDE + 1] ?? 0)
    return
  }
  for (const slot of subject) {
    const k = frame * SLOT_COUNT + slot
    if ((f.type[k] ?? -1) >= 0) add(f.players.x[k] ?? 0, f.players.y[k] ?? 0)
  }
}

type Add = (x: number, y: number) => void

/** Time spent in each cell during `play_on`, for some players or the ball. */
export function heatmapOf(match: Match, { cols, rows, subject }: HeatmapQuery): Heatmap {
  const cells = new Float32Array(cols * rows)
  const add: Add = (x, y) => {
    const bin = binOf(x, y, cols, rows)
    cells[bin] = (cells[bin] ?? 0) + 1
  }
  for (let frame = 0; frame < match.frames.count; frame++) {
    if (match.frames.playmode[frame] === PLAY_ON) countFrame(match, frame, subject, add)
  }
  return { cols, rows, cells, peak: cells.reduce((a, b) => Math.max(a, b), 0) }
}

/** Slots of one side. */
export function slotsOf(side: Side): number[] {
  const first = side === 'l' ? 0 : PLAYERS_PER_SIDE
  return Array.from({ length: PLAYERS_PER_SIDE }, (_, i) => first + i)
}

/** True when the slot holds a connected player at a frame. */
function onPitch(match: Match, k: number): boolean {
  const { type, state } = match.frames
  return (type[k] ?? -1) >= 0 && ((state[k] ?? 0) & PlayerState.STAND) !== 0
}

/**
 * The offside line a defending side draws at a frame: its second-to-last player, no deeper
 * than the ball and never past the halfway line, as `OffsideRef::setOffsideMark` computes it
 * when a kick happens (rcssserver `src/referee.cpp:1124`). Disconnected players do not count, as
 * the server skips `!isEnabled()` (`src/referee.cpp:1184,1210`); a disabled player is written
 * with the `STAND` bit cleared (`Player::disable`, `src/player.cpp:479`). `null` with fewer than
 * two players.
 */
export function offsideLine(match: Match, frame: number, defending: Side): number | null {
  const f = match.frames
  const sign = defending === 'l' ? 1 : -1
  const depths: number[] = []
  for (const slot of slotsOf(defending)) {
    const k = frame * SLOT_COUNT + slot
    if (onPitch(match, k)) depths.push(sign * (f.players.x[k] ?? 0))
  }
  if (depths.length < 2) return null
  depths.sort((a, b) => a - b)
  const second = depths[1] ?? 0
  const ball = sign * (f.ball[frame * BALL_STRIDE] ?? 0)
  const line = sign * Math.min(second, ball, 0)
  return line === 0 ? 0 : line
}
