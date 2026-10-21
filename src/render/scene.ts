import type { Analysis } from '@/analysis/analyze'
import { offsideLine } from '@/analysis/field'
import type { Heatmap } from '@/analysis/field'
import { PITCH_LENGTH, PITCH_WIDTH } from '@/analysis/params'
import { BALL_STRIDE, type Match, PLAYERS_PER_SIDE, PlayerState, SLOT_COUNT } from '@/rcg/types'

import { type Camera, type Point, type Viewport, toScreen, worldTransform } from './camera'
import type { Palette } from './palette'
import { clipToGrass, drawPitch } from './pitch'
import { type PlayerPose, ballAt, posesAt } from './sample'

/** Layers the person can switch on and off. */
export interface Overlays {
  trails: boolean
  cones: boolean
  offside: boolean
  heatmap: boolean
  stamina: boolean
}

/** Everything one canvas paint needs. */
export interface SceneInput {
  match: Match
  analysis: Analysis
  frame: number
  camera: Camera
  viewport: Viewport
  dpr: number
  palette: Palette
  overlays: Overlays
  selected: number
  hovered: number
  heatmap: Heatmap | null
}

const HALF = 0.5
const HALF_TURN = 180
const DASH_ON = 6
const DASH_OFF = 5
const ACTION_RING_PX = 2.5
const LABEL_SCALE = 1.1
const LABEL_NUDGE_PX = 0.5
const DEG = Math.PI / HALF_TURN
const MIN_PLAYER_PX = 9
const MIN_BALL_PX = 3.5
const LABEL_MAX_PX = 18
const TRAIL_FRAMES = 40
const VIEW_CONE_METERS = 25
const CONE_ALPHA = 0.08
const KICKABLE_ALPHA = 0.35
const HEAT_ALPHA = 0.75
const STAMINA_BAR_PX = 3
const STAMINA_GAP_PX = 4
const BODY_LINE = 2
const BODY_ARC = 0.5
const BODY_GAP_PX = 2
const SELECT_RING_PX = 3.5
const CARD_W = 4
const CARD_H = 6
const DASH = [DASH_ON, DASH_OFF]
const FONT = '600 {px}px "Geist Variable", system-ui, sans-serif'

function px(input: SceneInput, world: Point): Point {
  return toScreen(input.camera, input.viewport, world)
}

function teamColor(input: SceneInput, slot: number): string {
  return slot < PLAYERS_PER_SIDE ? input.palette.teamL : input.palette.teamR
}

function screenAngle(input: SceneInput, degrees: number): number {
  return degrees * DEG - (input.camera.upright ? Math.PI * HALF : 0)
}

function drawHeatmap(ctx: CanvasRenderingContext2D, input: SceneInput, color: string) {
  const map = input.heatmap
  if (map === null || map.peak === 0) return
  const w = PITCH_LENGTH / map.cols
  const h = PITCH_WIDTH / map.rows
  ctx.fillStyle = color
  for (let i = 0; i < map.cells.length; i++) {
    const value = (map.cells[i] ?? 0) / map.peak
    if (value === 0) continue
    ctx.globalAlpha = Math.sqrt(value) * HEAT_ALPHA
    const col = i % map.cols
    const row = Math.floor(i / map.cols)
    ctx.fillRect(-PITCH_LENGTH * HALF + col * w, -PITCH_WIDTH * HALF + row * h, w, h)
  }
  ctx.globalAlpha = 1
}

function drawOffside(ctx: CanvasRenderingContext2D, input: SceneInput) {
  const frame = Math.round(input.frame)
  ctx.lineWidth = 1 / input.camera.scale
  ctx.setLineDash(DASH.map((d) => d / input.camera.scale))
  for (const side of ['l', 'r'] as const) {
    const x = offsideLine(input.match, frame, side)
    if (x === null || x === 0) continue
    ctx.strokeStyle = side === 'l' ? input.palette.teamL : input.palette.teamR
    ctx.beginPath()
    ctx.moveTo(x, -PITCH_WIDTH * HALF)
    ctx.lineTo(x, PITCH_WIDTH * HALF)
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function drawTrail(ctx: CanvasRenderingContext2D, input: SceneInput, slot: number) {
  const f = input.match.frames
  const end = Math.floor(input.frame)
  const start = Math.max(0, end - TRAIL_FRAMES)
  ctx.lineWidth = 2 / input.camera.scale
  ctx.strokeStyle = slot < 0 ? input.palette.ball : teamColor(input, slot)
  for (let i = start + 1; i <= end; i++) {
    const [ax, ay, bx, by] =
      slot < 0
        ? [
            f.ball[(i - 1) * BALL_STRIDE],
            f.ball[(i - 1) * BALL_STRIDE + 1],
            f.ball[i * BALL_STRIDE],
            f.ball[i * BALL_STRIDE + 1],
          ]
        : [
            f.players.x[(i - 1) * SLOT_COUNT + slot],
            f.players.y[(i - 1) * SLOT_COUNT + slot],
            f.players.x[i * SLOT_COUNT + slot],
            f.players.y[i * SLOT_COUNT + slot],
          ]
    ctx.globalAlpha = (i - start) / (end - start + 1)
    ctx.beginPath()
    ctx.moveTo(ax ?? 0, ay ?? 0)
    ctx.lineTo(bx ?? 0, by ?? 0)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawCone(ctx: CanvasRenderingContext2D, input: SceneInput, pose: PlayerPose) {
  const width = (input.match.frames.players.viewWidth[pose.k] ?? 0) * DEG
  if (width <= 0) return
  const facing = (pose.body + pose.neck) * DEG
  ctx.fillStyle = teamColor(input, pose.slot)
  ctx.globalAlpha = CONE_ALPHA
  ctx.beginPath()
  ctx.moveTo(pose.x, pose.y)
  ctx.arc(pose.x, pose.y, VIEW_CONE_METERS, facing - width * HALF, facing + width * HALF)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
}

/** Layers drawn under the players, in world meters. */
function drawWorld(ctx: CanvasRenderingContext2D, input: SceneInput, poses: PlayerPose[]) {
  const { camera, viewport, dpr, palette, overlays, analysis, selected } = input
  ctx.setTransform(worldTransform(camera, viewport, dpr))
  drawPitch(ctx, camera.scale, analysis.physics.goalWidth, palette)
  clipToGrass(ctx, camera.scale)
  if (overlays.heatmap)
    drawHeatmap(ctx, input, selected < 0 ? palette.foreground : teamColor(input, selected))
  if (overlays.offside) drawOffside(ctx, input)
  for (const pose of poses) {
    if (overlays.cones || pose.slot === selected) drawCone(ctx, input, pose)
  }
  if (overlays.trails) {
    drawTrail(ctx, input, -1)
    if (selected >= 0) drawTrail(ctx, input, selected)
  }
  ctx.restore()
}

function playerRadius(input: SceneInput): number {
  return Math.max(input.analysis.physics.playerSize * input.camera.scale, MIN_PLAYER_PX)
}

function drawKickable(
  ctx: CanvasRenderingContext2D,
  input: SceneInput,
  pose: PlayerPose,
  at: Point,
) {
  const type = input.match.frames.type[pose.k] ?? 0
  const { physics } = input.analysis
  const margin = physics.kickableMargins[type] ?? physics.kickableMargins[0] ?? 0
  const radius = (physics.playerSize + physics.ballSize + margin) * input.camera.scale
  if (radius <= playerRadius(input) + 1) return
  ctx.globalAlpha = KICKABLE_ALPHA
  ctx.strokeStyle = teamColor(input, pose.slot)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function cardColor(palette: Palette, state: number): string | null {
  if (state & PlayerState.RED_CARD) return palette.card
  if (state & PlayerState.YELLOW_CARD) return palette.foul
  return null
}

function drawMarks(ctx: CanvasRenderingContext2D, input: SceneInput, pose: PlayerPose, at: Point) {
  const state = input.match.frames.state[pose.k] ?? 0
  const r = playerRadius(input)
  const acting = state & (PlayerState.KICK | PlayerState.TACKLE | PlayerState.CATCH)
  if (acting !== 0) {
    ctx.strokeStyle = state & PlayerState.TACKLE ? input.palette.foul : input.palette.foreground
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(at.x, at.y, r + ACTION_RING_PX, 0, Math.PI * 2)
    ctx.stroke()
  }
  const card = cardColor(input.palette, state)
  if (card !== null) {
    ctx.fillStyle = card
    ctx.fillRect(at.x + r * HALF, at.y - r - CARD_H, CARD_W, CARD_H)
  }
}

function drawStamina(
  ctx: CanvasRenderingContext2D,
  input: SceneInput,
  pose: PlayerPose,
  at: Point,
) {
  const stamina = input.match.frames.players.stamina[pose.k] ?? 0
  const share = Math.min(1, stamina / input.analysis.physics.staminaMax)
  const r = playerRadius(input)
  const y = at.y + r + STAMINA_GAP_PX
  ctx.fillStyle = input.palette.line
  ctx.fillRect(at.x - r, y, r * 2, STAMINA_BAR_PX)
  ctx.fillStyle = share < HALF * HALF ? input.palette.card : teamColor(input, pose.slot)
  ctx.fillRect(at.x - r, y, r * 2 * share, STAMINA_BAR_PX)
}

function drawPlayer(ctx: CanvasRenderingContext2D, input: SceneInput, pose: PlayerPose) {
  const at = px(input, pose)
  const r = playerRadius(input)
  const goalie = ((input.match.frames.state[pose.k] ?? 0) & PlayerState.GOALIE) !== 0
  drawKickable(ctx, input, pose, at)
  ctx.fillStyle = teamColor(input, pose.slot)
  ctx.beginPath()
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2)
  ctx.fill()
  if (goalie) {
    ctx.strokeStyle = input.palette.foreground
    ctx.lineWidth = 2
    ctx.stroke()
  }
  const angle = screenAngle(input, pose.body)
  ctx.strokeStyle = input.palette.foreground
  ctx.lineWidth = BODY_LINE
  ctx.beginPath()
  ctx.arc(at.x, at.y, r + BODY_GAP_PX, angle - BODY_ARC, angle + BODY_ARC)
  ctx.stroke()
  label(ctx, input, pose, at)
  drawMarks(ctx, input, pose, at)
  if (input.overlays.stamina) drawStamina(ctx, input, pose, at)
  if (pose.slot === input.selected || pose.slot === input.hovered) ring(ctx, input, pose, at)
}

function label(ctx: CanvasRenderingContext2D, input: SceneInput, pose: PlayerPose, at: Point) {
  const size = Math.round(Math.min(playerRadius(input) * LABEL_SCALE, LABEL_MAX_PX))
  ctx.font = FONT.replace('{px}', String(size))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = pose.slot < PLAYERS_PER_SIDE ? input.palette.inkL : input.palette.inkR
  ctx.fillText(String((pose.slot % PLAYERS_PER_SIDE) + 1), at.x, at.y + LABEL_NUDGE_PX)
}

function ring(ctx: CanvasRenderingContext2D, input: SceneInput, pose: PlayerPose, at: Point) {
  const r = playerRadius(input)
  ctx.strokeStyle = input.palette.ring
  ctx.globalAlpha = pose.slot === input.selected ? 1 : HALF
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(at.x, at.y, r + SELECT_RING_PX, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawBall(ctx: CanvasRenderingContext2D, input: SceneInput) {
  const ball = ballAt(input.match, input.frame)
  const at = px(input, ball)
  const r = Math.max(input.analysis.physics.ballSize * input.camera.scale, MIN_BALL_PX)
  ctx.fillStyle = input.palette.ball
  ctx.strokeStyle = input.palette.ballRing
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

/** Paints one frame: pitch, overlays, players and ball. */
export function drawScene(ctx: CanvasRenderingContext2D, input: SceneInput): void {
  const { viewport, dpr, palette } = input
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, viewport.width * dpr, viewport.height * dpr)
  const poses = posesAt(input.match, input.frame)
  drawWorld(ctx, input, poses)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  for (const pose of poses) drawPlayer(ctx, input, pose)
  drawBall(ctx, input)
}

/** The player under a screen point, or -1. */
export function slotAt(
  input: Pick<SceneInput, 'match' | 'frame' | 'camera' | 'viewport' | 'analysis'>,
  screen: Point,
): number {
  const radius =
    Math.max(input.analysis.physics.playerSize * input.camera.scale, MIN_PLAYER_PX) + SELECT_RING_PX
  let best = -1
  let bestDistance = radius
  for (const pose of posesAt(input.match, input.frame)) {
    const at = toScreen(input.camera, input.viewport, pose)
    const distance = Math.hypot(at.x - screen.x, at.y - screen.y)
    if (distance <= bestDistance) {
      best = pose.slot
      bestDistance = distance
    }
  }
  return best
}
