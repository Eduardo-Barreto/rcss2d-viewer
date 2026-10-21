import type { Analysis } from '@/analysis/analyze'
import { PLAY_ON } from '@/rcg/playmodes'
import type { Match } from '@/rcg/types'

import type { Palette } from './palette'

/** A mark on the timeline: where it is and how it is drawn. */
export interface TimelineMark {
  frame: number
  kind: 'goal' | 'shot' | 'card'
  side: 'l' | 'r' | null
  strong: boolean
}

/** Everything one timeline paint needs. */
export interface TimelineInput {
  match: Match
  analysis: Analysis
  marks: TimelineMark[]
  /** Frames where a half ends, drawn as dividers. */
  halves: number[]
  width: number
  height: number
  dpr: number
  palette: Palette
}

const STRIP_PX = 4
const MARK_GAP_PX = 3
const SHOT_PX = 5
const GOAL_PX = 3
const CARD_W = 3
const CARD_H = 5
const WEAK_ALPHA = 0.45
const STRIP_ALPHA = 0.8
const HALF_PX = 0.5

/** Owner of most `play_on` frames in `[start, end)`: 0 left, 1 right, -1 nobody. */
export function ownerOfRange(match: Match, owner: Int8Array, start: number, end: number): number {
  let left = 0
  let right = 0
  for (let frame = start; frame < end; frame++) {
    if (match.frames.playmode[frame] !== PLAY_ON) continue
    if (owner[frame] === 0) left++
    else if (owner[frame] === 1) right++
  }
  if (left === 0 && right === 0) return -1
  return left >= right ? 0 : 1
}

function drawPossession(
  ctx: CanvasRenderingContext2D,
  input: TimelineInput,
  x: (f: number) => number,
) {
  const { match, analysis, width, height, palette } = input
  const y = height - STRIP_PX
  const columns = Math.max(1, Math.floor(width))
  const per = match.frames.count / columns
  ctx.globalAlpha = STRIP_ALPHA
  for (let column = 0; column < columns; column++) {
    const start = Math.floor(column * per)
    const end = Math.max(start + 1, Math.floor((column + 1) * per))
    const owner = ownerOfRange(match, analysis.owner, start, end)
    ctx.fillStyle = [palette.teamL, palette.teamR][owner] ?? palette.line
    ctx.fillRect(column, y, 1, STRIP_PX)
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = palette.muted
  for (const frame of input.halves) ctx.fillRect(Math.round(x(frame)), 0, 1, height)
}

function markColor(palette: Palette, mark: TimelineMark): string {
  if (mark.kind === 'goal') return mark.side === 'r' ? palette.teamR : palette.teamL
  if (mark.kind === 'card') return mark.strong ? palette.card : palette.foul
  return palette.shot
}

function drawMark(
  ctx: CanvasRenderingContext2D,
  input: TimelineInput,
  mark: TimelineMark,
  at: number,
) {
  const base = input.height - STRIP_PX - MARK_GAP_PX
  ctx.fillStyle = markColor(input.palette, mark)
  ctx.globalAlpha = mark.strong || mark.kind === 'goal' ? 1 : WEAK_ALPHA
  if (mark.kind === 'goal') {
    ctx.beginPath()
    ctx.arc(at, GOAL_PX + 1, GOAL_PX, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(at - HALF_PX, GOAL_PX * 2, 1, base - GOAL_PX * 2)
  } else if (mark.kind === 'card') {
    ctx.fillRect(at - CARD_W / 2, base - CARD_H - SHOT_PX - 1, CARD_W, CARD_H)
  } else {
    ctx.fillRect(at - HALF_PX, base - SHOT_PX, 1, SHOT_PX)
  }
  ctx.globalAlpha = 1
}

/** Paints the possession strip, the half dividers and the goal, shot and card marks. */
export function drawTimeline(ctx: CanvasRenderingContext2D, input: TimelineInput): void {
  const { width, height, dpr, match } = input
  const last = Math.max(1, match.frames.count - 1)
  const x = (frame: number) => (frame / last) * width
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  drawPossession(ctx, input, x)
  const order = { shot: 0, card: 1, goal: 2 }
  for (const mark of input.marks.toSorted((a, b) => order[a.kind] - order[b.kind])) {
    drawMark(ctx, input, mark, Math.round(x(mark.frame)) + HALF_PX)
  }
}
