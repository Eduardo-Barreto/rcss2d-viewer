import type { Analysis } from '@/analysis/analyze'
import { PITCH_LENGTH, PITCH_WIDTH } from '@/analysis/params'
import { clockOf, frameOfCycle, teamName } from '@/player/format'
import { playModeLabel } from '@/rcg/playmodes'
import type { Match, Side } from '@/rcg/types'
import { PITCH_MARGIN, type Viewport, fitCamera } from '@/render/camera'
import type { Palette } from '@/render/palette'
import { type Overlays, drawScene } from '@/render/scene'

import { CLIP_MAX_WIDTH, CLIP_MIN_WIDTH } from './headless-protocol'

/** Longest clip, in log frames: 60 s of play keeps a GIF inside what GitHub proxies. */
const CLIP_MAX_FRAMES = 600
/** Default clip width in pixels. */
export const CLIP_WIDTH = 720
/** Height of the strip above the pitch with the cycle, the score and the play mode. */
const HUD_PX = 28
const HUD_FONT_PX = 13
const HUD_PAD_PX = 10
const DOT_PX = 4
const DOT_GAP_PX = 6
const SCORE_GAP_PX = 10
const HALF = 0.5
const WEIGHT_NAME = 500
const WEIGHT_STRONG = 600
/** Same floor as the landing figures (ADR 0005): the clip fits the whole pitch at a similar scale. */
const CLIP_PLAYER_PX = 7
const NO_OVERLAYS: Overlays = {
  trails: false,
  cones: false,
  offside: false,
  heatmap: false,
  stamina: false,
}

/** The log frames a clip covers. */
export interface ClipRange {
  /** First and last cycle actually in the clip. */
  from: number
  to: number
  /** First frame index and the number of frames. */
  start: number
  count: number
}

/** Pixel size of a clip and the viewport the pitch is drawn in. */
export interface ClipSize {
  width: number
  height: number
  viewport: Viewport
}

function lastFrameUpTo(match: Match, start: number, toCycle: number): number {
  const { cycle, count } = match.frames
  let end = start
  while (end < count && (cycle[end] ?? 0) <= toCycle) end++
  return end
}

function assertOrder(fromCycle: number, toCycle: number): void {
  if (!Number.isInteger(fromCycle) || !Number.isInteger(toCycle) || toCycle < fromCycle) {
    throw new RangeError('O ciclo final precisa vir depois do inicial.')
  }
}

/**
 * The frames whose cycle falls in `fromCycle..toCycle`. Stoppages repeat a cycle, so the count
 * can pass the cycle span. Throws a `RangeError` with a message for people when the range is
 * empty, reversed or longer than `maxFrames`.
 */
export function clipRange(
  match: Match,
  fromCycle: number,
  toCycle: number,
  maxFrames = CLIP_MAX_FRAMES,
): ClipRange {
  assertOrder(fromCycle, toCycle)
  const { cycle } = match.frames
  const start = frameOfCycle(match, fromCycle)
  const end = lastFrameUpTo(match, start, toCycle)
  if (end === start || (cycle[start] ?? 0) < fromCycle) {
    throw new RangeError(`A partida não tem ciclos entre ${fromCycle} e ${toCycle}.`)
  }
  if (end - start > maxFrames) {
    throw new RangeError(`O trecho passa de ${maxFrames} quadros. Escolha um pedaço menor.`)
  }
  return { from: cycle[start] ?? 0, to: cycle[end - 1] ?? 0, start, count: end - start }
}

/** Cycles before and after the current one that a new clip starts with. */
const CLIP_BEFORE = 100
const CLIP_AFTER = 50
const MS = 1000

/** The default clip around `cycle`: a little before, less after, inside the match. */
export function defaultClip(match: Match, cycle: number): { from: number; to: number } {
  const { cycle: cycles, count } = match.frames
  const first = cycles[0] ?? 0
  const last = cycles[count - 1] ?? 0
  return { from: Math.max(first, cycle - CLIP_BEFORE), to: Math.min(last, cycle + CLIP_AFTER) }
}

/** The verdict on a typed range: how long the clip is, or why it cannot be made. */
export type ClipCheck =
  | { ok: true; frames: number; seconds: number }
  | { ok: false; reason: string }

/** Whether the typed `from..to` makes a clip of `match`, and how long it plays. */
export function checkClip(match: Match, stepMs: number, from: string, to: string): ClipCheck {
  if (from.trim() === '' || to.trim() === '') {
    return { ok: false, reason: 'Diga o ciclo inicial e o final.' }
  }
  try {
    const { count } = clipRange(match, Number(from), Number(to))
    return { ok: true, frames: count, seconds: (count * stepMs) / MS }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

/** Clip size for a width in pixels: the whole pitch, with its margin, under the strip. */
export function clipSize(width = CLIP_WIDTH): ClipSize {
  const w = Math.round(Math.min(Math.max(width, CLIP_MIN_WIDTH), CLIP_MAX_WIDTH))
  const pitch = Math.round(
    (w * (PITCH_WIDTH + PITCH_MARGIN * 2)) / (PITCH_LENGTH + PITCH_MARGIN * 2),
  )
  const height = pitch + HUD_PX
  return {
    width: w,
    height,
    viewport: { width: w, height, insets: { top: HUD_PX, right: 0, bottom: 0, left: 0 } },
  }
}

/** What one clip frame needs. */
export interface ClipFrameInput {
  match: Match
  analysis: Analysis
  palette: Palette
  size: ClipSize
  frame: number
}

function font(weight: number): string {
  return `${weight} ${HUD_FONT_PX}px "Geist Variable", system-ui, sans-serif`
}

function team(ctx: CanvasRenderingContext2D, input: ClipFrameInput, side: Side, x: number) {
  const { palette, match } = input
  const y = HUD_PX * HALF
  const name = teamName(match, side)
  ctx.font = font(WEIGHT_NAME)
  ctx.textAlign = side === 'l' ? 'right' : 'left'
  ctx.fillStyle = palette.foreground
  const dot =
    side === 'l'
      ? x - ctx.measureText(name).width - DOT_GAP_PX
      : x + ctx.measureText(name).width + DOT_GAP_PX
  ctx.fillText(name, x, y)
  ctx.fillStyle = side === 'l' ? palette.teamL : palette.teamR
  ctx.beginPath()
  ctx.arc(dot, y, DOT_PX, 0, Math.PI * 2)
  ctx.fill()
}

/** The strip above the pitch: cycle and clock, teams and score, play mode. Log text stays canvas text. */
function drawHud(ctx: CanvasRenderingContext2D, input: ClipFrameInput) {
  const { match, analysis, palette, size, frame } = input
  const cycle = match.frames.cycle[frame] ?? 0
  const y = HUD_PX * HALF
  const middle = size.width * HALF
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.textBaseline = 'middle'
  ctx.font = font(WEIGHT_STRONG)
  ctx.fillStyle = palette.muted
  ctx.textAlign = 'left'
  ctx.fillText(`ciclo ${cycle} · ${clockOf(cycle, analysis.physics.stepMs)}`, HUD_PAD_PX, y)
  ctx.textAlign = 'right'
  ctx.fillText(playModeLabel(match.frames.playmode[frame] ?? 0), size.width - HUD_PAD_PX, y)
  const score = `${match.frames.scoreLeft[frame] ?? 0} × ${match.frames.scoreRight[frame] ?? 0}`
  ctx.font = font(WEIGHT_STRONG)
  ctx.textAlign = 'center'
  ctx.fillStyle = palette.foreground
  ctx.fillText(score, middle, y)
  const half = ctx.measureText(score).width * HALF + SCORE_GAP_PX
  team(ctx, input, 'l', middle - half)
  team(ctx, input, 'r', middle + half)
}

/** Paints one clip frame with the app's renderer, whole pitch, no layers, plus the strip. */
export function drawClipFrame(ctx: CanvasRenderingContext2D, input: ClipFrameInput): void {
  const { size } = input
  drawScene(ctx, {
    match: input.match,
    analysis: input.analysis,
    frame: input.frame,
    camera: fitCamera(size.viewport),
    viewport: size.viewport,
    dpr: 1,
    palette: input.palette,
    overlays: NO_OVERLAYS,
    selected: -1,
    hovered: -1,
    heatmap: null,
    minPlayerPx: CLIP_PLAYER_PX,
  })
  drawHud(ctx, input)
}
