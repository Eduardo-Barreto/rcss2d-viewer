import { useTheme } from 'next-themes'
import { useEffect, useMemo, useRef } from 'react'

import { type Heatmap, heatmapOf, slotsOf } from '@/analysis/field'
import { useCamera } from '@/player/camera-store'
import { type HeatSubject, type ReplayState, useReplay } from '@/player/store'
import { type Camera, type Point, type Viewport, centerOn } from '@/render/camera'
import { type Palette, readPalette } from '@/render/palette'
import { ballAt, posesAt } from '@/render/sample'
import { drawScene } from '@/render/scene'

import { PointerController } from './pointer-controller'

/** Space the islands cover on each edge, in CSS pixels. */
export type Insets = Viewport['insets']

const HEAT_COLS = 35
const HEAT_ROWS = 23

function heatSubject(heat: HeatSubject, selected: number): number[] | 'ball' {
  if (heat === 'ball') return 'ball'
  if (heat === 'selected') return selected < 0 ? 'ball' : [selected]
  return slotsOf(heat)
}

function followTarget(state: ReplayState): Point | null {
  const { match, frame, follow, selected } = state
  if (match === null || follow === 'off') return null
  if (follow === 'ball') return ballAt(match, frame)
  return posesAt(match, frame).find((pose) => pose.slot === selected) ?? null
}

/** The camera the canvas shows now: the stored one, centered on the followed target if any. */
function viewCamera(): Camera {
  const { camera } = useCamera.getState()
  const target = followTarget(useReplay.getState())
  return target === null ? camera : centerOn(camera, target)
}

function useHeatmap(): Heatmap | null {
  const match = useReplay((s) => s.match)
  const on = useReplay((s) => s.overlays.heatmap)
  const heat = useReplay((s) => s.heat)
  const selected = useReplay((s) => (s.heat === 'selected' ? s.selected : -1))
  return useMemo(() => {
    if (match === null || !on) return null
    return heatmapOf(match, {
      cols: HEAT_COLS,
      rows: HEAT_ROWS,
      subject: heatSubject(heat, selected),
    })
  }, [match, on, heat, selected])
}

function usePointer(
  canvas: React.RefObject<HTMLCanvasElement | null>,
  hovered: React.RefObject<number>,
  redraw: () => void,
) {
  useEffect(() => {
    const element = canvas.current
    if (element === null) return undefined
    const controller = new PointerController(element, viewCamera, (slot) => {
      hovered.current = slot
      element.style.cursor = slot < 0 ? '' : 'pointer'
      redraw()
    })
    return controller.attach()
  }, [canvas, hovered, redraw])
}

function useViewport(canvas: React.RefObject<HTMLCanvasElement | null>, insets: Insets) {
  const { top, right, bottom, left } = insets
  useEffect(() => {
    const element = canvas.current
    if (element === null) return undefined
    const measure = () => {
      const box = element.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      element.width = Math.round(box.width * dpr)
      element.height = Math.round(box.height * dpr)
      useCamera.getState().setViewport({
        width: box.width,
        height: box.height,
        insets: { top, right, bottom, left },
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [canvas, top, right, bottom, left])
}

/** Props of {@link PitchView}. */
export interface PitchViewProps {
  insets: Insets
}

/**
 * The pitch canvas. It paints outside React: every change of the replay or the camera schedules
 * one animation frame, so playback never re-renders the component tree.
 */
export function PitchView({ insets }: PitchViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const hovered = useRef(-1)
  const palette = useRef<Palette | null>(null)
  const scheduled = useRef(0)
  const heatmap = useHeatmap()
  const heatRef = useRef(heatmap)
  const { resolvedTheme } = useTheme()

  const redraw = useMemo(
    () => () => {
      if (scheduled.current !== 0) return
      scheduled.current = requestAnimationFrame(() => {
        scheduled.current = 0
        const ctx = canvas.current?.getContext('2d')
        const state = useReplay.getState()
        if (!ctx || state.match === null || state.analysis === null) return
        palette.current ??= readPalette(document.documentElement)
        drawScene(ctx, {
          match: state.match,
          analysis: state.analysis,
          frame: state.frame,
          camera: viewCamera(),
          viewport: useCamera.getState().viewport,
          dpr: window.devicePixelRatio || 1,
          palette: palette.current,
          overlays: state.overlays,
          selected: state.selected,
          hovered: hovered.current,
          heatmap: heatRef.current,
        })
      })
    },
    [],
  )

  useEffect(() => {
    heatRef.current = heatmap
    redraw()
  }, [heatmap, redraw])

  useEffect(() => {
    palette.current = null
    redraw()
  }, [resolvedTheme, redraw])

  useEffect(() => {
    const offReplay = useReplay.subscribe(redraw)
    const offCamera = useCamera.subscribe(redraw)
    return () => {
      offReplay()
      offCamera()
      cancelAnimationFrame(scheduled.current)
      scheduled.current = 0
    }
  }, [redraw])

  useViewport(canvas, insets)
  usePointer(canvas, hovered, redraw)

  return (
    <>
      <canvas
        aria-hidden
        className="fixed inset-0 size-full touch-none select-none"
        data-pitch=""
        ref={canvas}
      />
      <p className="sr-only">
        O campo mostra a partida desenhada. Os mesmos dados estão no painel: estatísticas, eventos e
        jogadores.
      </p>
    </>
  )
}
