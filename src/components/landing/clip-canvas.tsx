import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'

import type { Heatmap } from '@/analysis/field'
import { cn } from '@/lib/utils'
import { type Viewport, fitCamera, worldTransform } from '@/render/camera'
import { type Palette, readPalette } from '@/render/palette'
import { drawPitch } from '@/render/pitch'
import { type Overlays, drawScene } from '@/render/scene'

import type { Clip } from './clip'
import type { FrameWindow } from './clip-windows'
import { nextFrame, shownFrame } from './playhead'
import { useReducedMotion, useVisible } from './use-motion'

const DEFAULT_GOAL_WIDTH = 14.02
const NO_OVERLAYS: Overlays = {
  trails: false,
  cones: false,
  offside: false,
  heatmap: false,
  stamina: false,
}

/** Props of {@link ClipCanvas}. */
export interface ClipCanvasProps {
  clip: Clip | null
  /** Which part of the clip to loop. */
  span: (clip: Clip) => FrameWindow
  overlays?: Overlays
  heatmap?: Heatmap | null
  /** Called with the whole frame each time the playhead reaches a new one. */
  onFrame?: (frame: number) => void
  className?: string
}

interface Size {
  viewport: Viewport
  dpr: number
}

/** What one paint of the canvas needs besides the canvas itself. */
interface Paint {
  clip: Clip | null
  loop: FrameWindow | null
  frame: number
  overlays: Overlays
  heatmap: Heatmap | null
}

/**
 * Player radius floor on the landing figures. They fit the whole pitch in 350 to 670 px, about
 * 3 to 6 px per meter, so the app's 9 px floor drew each player 1.6 to 3 m in radius. 7 px is the
 * smallest that keeps the shirt number legible, and puts the hero (5 px per meter) near
 * rcssmonitor's default, which draws a player at its kickable radius of about 1.1 m.
 */
const LANDING_PLAYER_PX = 7
const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

function measure(element: HTMLCanvasElement): Size {
  const box = element.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  element.width = Math.round(box.width * dpr)
  element.height = Math.round(box.height * dpr)
  return { viewport: { width: box.width, height: box.height, insets: NO_INSETS }, dpr }
}

function paintEmpty(ctx: CanvasRenderingContext2D, size: Size, palette: Palette): void {
  const camera = fitCamera(size.viewport)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.setTransform(worldTransform(camera, size.viewport, size.dpr))
  drawPitch(ctx, camera.scale, DEFAULT_GOAL_WIDTH, palette)
}

function paint(element: HTMLCanvasElement, size: Size, palette: Palette, state: Paint): void {
  const ctx = element.getContext('2d')
  if (!ctx) return
  const { clip, loop } = state
  if (clip === null || loop === null) {
    paintEmpty(ctx, size, palette)
    return
  }
  drawScene(ctx, {
    match: clip.match,
    analysis: clip.analysis,
    frame: shownFrame(state.frame, loop),
    camera: fitCamera(size.viewport),
    viewport: size.viewport,
    dpr: size.dpr,
    palette,
    overlays: state.overlays,
    selected: -1,
    hovered: -1,
    heatmap: state.heatmap,
    minPlayerPx: LANDING_PLAYER_PX,
  })
}

/** The frame a span starts on: its still under reduced motion, else where it left off. */
function startFrame(current: number, loop: FrameWindow, reduced: boolean): number {
  if (reduced) return loop.still
  return current < loop.from ? loop.from : current
}

/**
 * The app's own renderer on a small canvas, looping a span of the example clip. It plays only
 * while on screen and the tab is visible, and holds a still frame when motion is reduced.
 */
export function ClipCanvas({
  clip,
  span,
  overlays = NO_OVERLAYS,
  heatmap = null,
  onFrame,
  className,
}: ClipCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef(-1)
  const reduced = useReducedMotion()
  const visible = useVisible(canvas)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const element = canvas.current
    if (element === null) return undefined
    const loop = clip === null ? null : span(clip)
    if (loop !== null) frame.current = startFrame(frame.current, loop, reduced)
    const palette = readPalette(document.documentElement)
    let size = measure(element)
    let raf = 0
    let last = 0
    const draw = () =>
      paint(element, size, palette, { clip, loop, frame: frame.current, overlays, heatmap })
    const shown = () => (loop === null ? -1 : Math.floor(shownFrame(frame.current, loop)))

    const tick = (now: number) => {
      if (clip !== null && loop !== null) {
        const before = shown()
        frame.current = nextFrame(frame.current, now - last, clip.analysis.physics.stepMs, loop)
        if (shown() !== before) onFrame?.(shown())
      }
      last = now
      draw()
      raf = requestAnimationFrame(tick)
    }

    draw()
    if (loop !== null) onFrame?.(shown())
    const observer = new ResizeObserver(() => {
      size = measure(element)
      draw()
    })
    observer.observe(element)
    if (loop !== null && !reduced && visible) {
      raf = requestAnimationFrame((now) => {
        last = now
        tick(now)
      })
    }
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [clip, span, reduced, visible, resolvedTheme, overlays, heatmap, onFrame])

  return (
    <canvas aria-hidden className={cn('block size-full select-none', className)} ref={canvas} />
  )
}
