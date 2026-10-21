import {
  CENTER_CIRCLE_RADIUS,
  GOAL_AREA_LENGTH,
  GOAL_AREA_WIDTH,
  GOAL_DEPTH,
  PENALTY_AREA_LENGTH,
  PENALTY_AREA_WIDTH,
  PENALTY_SPOT_DISTANCE,
  PITCH_LENGTH,
  PITCH_WIDTH,
} from '@/analysis/params'

import { PITCH_MARGIN } from './camera'
import type { Palette } from './palette'

const HALF = 0.5
const LINE_PX = 1.25
const SPOT_PX = 2
const CORNER_RADIUS = 1
const GRASS_CORNER_PX = 12
const GOAL_FILL_ALPHA = 0.5
const QUARTER = Math.PI * HALF

function areaPath(ctx: CanvasRenderingContext2D, depth: number, width: number, sign: number) {
  const goalX = sign * PITCH_LENGTH * HALF
  ctx.rect(Math.min(goalX, goalX - sign * depth), -width * HALF, depth, width)
}

/** The penalty arc: the part of the circle around the spot outside the penalty area. */
function penaltyArc(ctx: CanvasRenderingContext2D, sign: number) {
  const spot = sign * (PITCH_LENGTH * HALF - PENALTY_SPOT_DISTANCE)
  const edge = PENALTY_AREA_LENGTH - PENALTY_SPOT_DISTANCE
  const angle = Math.acos(edge / CENTER_CIRCLE_RADIUS)
  const facing = sign > 0 ? Math.PI : 0
  ctx.moveTo(
    spot + CENTER_CIRCLE_RADIUS * Math.cos(facing - angle),
    CENTER_CIRCLE_RADIUS * Math.sin(facing - angle),
  )
  ctx.arc(spot, 0, CENTER_CIRCLE_RADIUS, facing - angle, facing + angle)
}

function cornerArcs(ctx: CanvasRenderingContext2D) {
  const hx = PITCH_LENGTH * HALF
  const hy = PITCH_WIDTH * HALF
  const corners: [number, number, number][] = [
    [-hx, -hy, 0],
    [hx, -hy, QUARTER],
    [hx, hy, Math.PI],
    [-hx, hy, -QUARTER],
  ]
  for (const [x, y, start] of corners) {
    ctx.moveTo(x + CORNER_RADIUS * Math.cos(start), y + CORNER_RADIUS * Math.sin(start))
    ctx.arc(x, y, CORNER_RADIUS, start, start + QUARTER)
  }
}

function lines(ctx: CanvasRenderingContext2D) {
  const hx = PITCH_LENGTH * HALF
  const hy = PITCH_WIDTH * HALF
  ctx.beginPath()
  ctx.rect(-hx, -hy, PITCH_LENGTH, PITCH_WIDTH)
  ctx.moveTo(0, -hy)
  ctx.lineTo(0, hy)
  ctx.moveTo(CENTER_CIRCLE_RADIUS, 0)
  ctx.arc(0, 0, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2)
  for (const sign of [-1, 1]) {
    areaPath(ctx, PENALTY_AREA_LENGTH, PENALTY_AREA_WIDTH, sign)
    areaPath(ctx, GOAL_AREA_LENGTH, GOAL_AREA_WIDTH, sign)
    penaltyArc(ctx, sign)
  }
  cornerArcs(ctx)
  ctx.stroke()
}

function spots(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath()
  for (const x of [
    0,
    -(PITCH_LENGTH * HALF - PENALTY_SPOT_DISTANCE),
    PITCH_LENGTH * HALF - PENALTY_SPOT_DISTANCE,
  ]) {
    ctx.moveTo(x + radius, 0)
    ctx.arc(x, 0, radius, 0, Math.PI * 2)
  }
  ctx.fill()
}

function goals(ctx: CanvasRenderingContext2D, goalWidth: number, palette: Palette) {
  const hx = PITCH_LENGTH * HALF
  ctx.beginPath()
  ctx.rect(-hx - GOAL_DEPTH, -goalWidth * HALF, GOAL_DEPTH, goalWidth)
  ctx.rect(hx, -goalWidth * HALF, GOAL_DEPTH, goalWidth)
  ctx.globalAlpha = GOAL_FILL_ALPHA
  ctx.fillStyle = palette.line
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.stroke()
}

function grass(ctx: CanvasRenderingContext2D, scale: number) {
  const hx = PITCH_LENGTH * HALF + PITCH_MARGIN
  const hy = PITCH_WIDTH * HALF + PITCH_MARGIN
  ctx.beginPath()
  ctx.roundRect(-hx, -hy, hx * 2, hy * 2, GRASS_CORNER_PX / scale)
}

/** Clips what follows to the grass, so long overlays stop at its edge. Pair with `restore()`. */
export function clipToGrass(ctx: CanvasRenderingContext2D, scale: number): void {
  ctx.save()
  grass(ctx, scale)
  ctx.clip()
}

/**
 * Draws the grass, the lines and the goals in world meters. `ctx` must already carry the world
 * transform; `scale` is pixels per meter, so line widths stay the same on screen at any zoom.
 */
export function drawPitch(
  ctx: CanvasRenderingContext2D,
  scale: number,
  goalWidth: number,
  palette: Palette,
) {
  const px = 1 / scale
  ctx.fillStyle = palette.pitch
  grass(ctx, scale)
  ctx.fill()
  ctx.strokeStyle = palette.line
  ctx.lineWidth = LINE_PX * px
  lines(ctx)
  ctx.fillStyle = palette.line
  spots(ctx, SPOT_PX * px)
  goals(ctx, goalWidth, palette)
}
