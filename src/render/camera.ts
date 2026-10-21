import { PITCH_LENGTH, PITCH_WIDTH } from '@/analysis/params'

/** Meters of grass drawn around the lines, enough for the goals and a ball just out. */
export const PITCH_MARGIN = 4

const HALF = 0.5
const MIN_ZOOM = 0.5
const MAX_ZOOM = 16

/** Canvas size in CSS pixels and the space islands cover on each edge. */
export interface Viewport {
  width: number
  height: number
  insets: { top: number; right: number; bottom: number; left: number }
}

/**
 * What the canvas shows: the world point at the middle of the free area, pixels per meter, and
 * whether the pitch is turned upright for a portrait screen (left goal at the bottom).
 */
export interface Camera {
  x: number
  y: number
  scale: number
  /** The scale that fits the whole pitch, the base of the zoom percentage. */
  fitScale: number
  upright: boolean
}

/** A point on the screen or in the world. */
export interface Point {
  x: number
  y: number
}

function freeArea(viewport: Viewport) {
  const { width, height, insets } = viewport
  const w = Math.max(1, width - insets.left - insets.right)
  const h = Math.max(1, height - insets.top - insets.bottom)
  return { w, h, cx: insets.left + w * HALF, cy: insets.top + h * HALF }
}

/** The camera that shows the whole pitch in the free area, upright when that is taller. */
export function fitCamera(viewport: Viewport): Camera {
  const { w, h } = freeArea(viewport)
  const long = PITCH_LENGTH + PITCH_MARGIN * 2
  const short = PITCH_WIDTH + PITCH_MARGIN * 2
  const upright = h > w
  const scale = upright ? Math.min(w / short, h / long) : Math.min(w / long, h / short)
  return { x: 0, y: 0, scale, fitScale: scale, upright }
}

/** World meters to CSS pixels. */
export function toScreen(camera: Camera, viewport: Viewport, world: Point): Point {
  const { cx, cy } = freeArea(viewport)
  const dx = (world.x - camera.x) * camera.scale
  const dy = (world.y - camera.y) * camera.scale
  return camera.upright ? { x: cx + dy, y: cy - dx } : { x: cx + dx, y: cy + dy }
}

/** CSS pixels to world meters. */
export function toWorld(camera: Camera, viewport: Viewport, screen: Point): Point {
  const { cx, cy } = freeArea(viewport)
  const sx = (screen.x - cx) / camera.scale
  const sy = (screen.y - cy) / camera.scale
  return camera.upright
    ? { x: camera.x - sy, y: camera.y + sx }
    : { x: camera.x + sx, y: camera.y + sy }
}

/** Zooms by `factor` keeping the world point under `anchor` still. */
export function zoomAt(camera: Camera, viewport: Viewport, factor: number, anchor: Point): Camera {
  const before = toWorld(camera, viewport, anchor)
  const min = camera.fitScale * MIN_ZOOM
  const max = camera.fitScale * MAX_ZOOM
  const scale = Math.min(max, Math.max(min, camera.scale * factor))
  const zoomed = { ...camera, scale }
  const after = toWorld(zoomed, viewport, anchor)
  return { ...zoomed, x: camera.x + before.x - after.x, y: camera.y + before.y - after.y }
}

/** Moves the view by a drag of `dx, dy` CSS pixels. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  const wx = (camera.upright ? -dy : dx) / camera.scale
  const wy = (camera.upright ? dx : dy) / camera.scale
  return { ...camera, x: camera.x - wx, y: camera.y - wy }
}

/** Centers the view on a world point, keeping the zoom. */
export function centerOn(camera: Camera, world: Point): Camera {
  return { ...camera, x: world.x, y: world.y }
}

/**
 * The 2D context transform that draws in world meters, for `devicePixelRatio` `dpr`. Upright
 * turns the world a quarter counter-clockwise, which keeps it a rotation and never a mirror.
 */
export function worldTransform(camera: Camera, viewport: Viewport, dpr: number): DOMMatrix2DInit {
  const origin = toScreen(camera, viewport, { x: 0, y: 0 })
  const s = camera.scale * dpr
  return camera.upright
    ? { a: 0, b: -s, c: s, d: 0, e: origin.x * dpr, f: origin.y * dpr }
    : { a: s, b: 0, c: 0, d: s, e: origin.x * dpr, f: origin.y * dpr }
}
