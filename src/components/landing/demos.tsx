import { useTheme } from 'next-themes'
import { type CSSProperties, useEffect, useId, useMemo, useRef, useState } from 'react'

import { heatmapOf } from '@/analysis/field'
import { cn } from '@/lib/utils'
import type { Moment } from '@/player/moments'
import { comparisonRows } from '@/player/panel-data'
import { readPalette } from '@/render/palette'
import type { Overlays } from '@/render/scene'
import { type TimelineMark, drawTimeline } from '@/render/timeline'

import type { Clip } from './clip'
import { ClipCanvas } from './clip-canvas'
import type { FrameWindow } from './clip-windows'
import { COPY } from './copy'
import { type LayerKey, LAYER_KEYS, activeMoment, layerAt, overlaysOf } from './demo-state'
import { PitchFrame } from './pitch-frame'
import { useReducedMotion } from './use-motion'

const wholeSpan = (clip: Clip): FrameWindow => clip.whole
const MARKED = new Set<Moment['kind']>(['goal', 'shot', 'card'])
const STRIP_PX = 24
const LAYER_MS = 3200
const HEAT_COLS = 35
const HEAT_ROWS = 23
const PERCENT = 100

const DOT: Record<Moment['kind'], string> = {
  goal: 'bg-(--event-goal)',
  shot: 'bg-(--event-shot)',
  foul: 'bg-(--event-foul)',
  card: 'bg-(--event-card)',
  setPiece: 'bg-muted-foreground',
}

function isMark(moment: Moment): moment is Moment & { kind: TimelineMark['kind'] } {
  return MARKED.has(moment.kind)
}

function Strip({ clip, frame }: { clip: Clip; frame: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const marks = useMemo(() => clip.moments.filter(isMark), [clip])
  const last = Math.max(1, clip.match.frames.count - 1)
  const head = useMemo<CSSProperties>(
    () => ({ left: `${(frame / last) * PERCENT}%` }),
    [frame, last],
  )

  useEffect(() => {
    const element = canvas.current
    if (element === null) return undefined
    const paint = () => {
      const ctx = element.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const { width } = element.getBoundingClientRect()
      element.width = Math.round(width * dpr)
      element.height = Math.round(STRIP_PX * dpr)
      drawTimeline(ctx, {
        match: clip.match,
        analysis: clip.analysis,
        marks,
        halves: [],
        width,
        height: STRIP_PX,
        dpr,
        palette: readPalette(document.documentElement),
      })
    }
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(element)
    return () => observer.disconnect()
  }, [clip, marks, resolvedTheme])

  return (
    <div aria-hidden className="relative h-6 w-full">
      <canvas className="absolute inset-0 h-6 w-full" ref={canvas} />
      <span
        className="absolute top-0 h-6 w-[2px] -translate-x-1/2 rounded-full bg-foreground"
        style={head}
      />
    </div>
  )
}

/** The clip next to its list of moments, the current one lit as the clip plays. */
export function MomentsDemo({ clip }: { clip: Clip | null }) {
  const [frame, setFrame] = useState(0)
  const current = clip === null ? null : activeMoment(clip.moments, frame)
  return (
    <figure className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex flex-col gap-3">
          <PitchFrame>
            <ClipCanvas clip={clip} onFrame={setFrame} span={wholeSpan} />
          </PitchFrame>
          {clip === null ? <div className="h-6" /> : <Strip clip={clip} frame={frame} />}
        </div>
        <ol aria-label={COPY.moments.list} className="flex flex-col gap-0.5 text-[13px]">
          {(clip?.moments ?? []).map((moment) => (
            <li
              aria-current={moment === current ? 'step' : undefined}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-muted-foreground transition-colors duration-150 ease-(--ease-out) aria-[current]:bg-card aria-[current]:text-foreground aria-[current]:shadow-island"
              key={`${moment.kind}-${moment.frame}-${moment.slot}`}
            >
              <span aria-hidden className={cn('size-2 flex-none rounded-full', DOT[moment.kind])} />
              <span className="min-w-0 flex-1 truncate">{moment.text}</span>
              <span className="font-mono text-[12px] tabular-nums">{moment.cycle}</span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="text-[13px] text-muted-foreground">{COPY.moments.figure}</figcaption>
    </figure>
  )
}

/** The clip with one layer at a time, cycling until a layer is picked. */
export function LayersDemo({ clip }: { clip: Clip | null }) {
  const reduced = useReducedMotion()
  const [pinned, setPinned] = useState<LayerKey | 'auto'>('auto')
  const [tick, setTick] = useState(0)
  const name = useId()

  useEffect(() => {
    if (pinned !== 'auto' || reduced) return undefined
    const timer = window.setInterval(() => setTick((n) => n + 1), LAYER_MS)
    return () => window.clearInterval(timer)
  }, [pinned, reduced])

  const layer = pinned === 'auto' ? layerAt(tick) : pinned
  const overlays = useMemo<Overlays>(() => overlaysOf(layer), [layer])
  const heatmap = useMemo(
    () =>
      clip === null || layer !== 'heatmap'
        ? null
        : heatmapOf(clip.match, { cols: HEAT_COLS, rows: HEAT_ROWS, subject: 'ball' }),
    [clip, layer],
  )

  return (
    <figure className="flex flex-col gap-3">
      <PitchFrame>
        <ClipCanvas clip={clip} heatmap={heatmap} overlays={overlays} span={wholeSpan} />
        <p
          aria-live="polite"
          className="absolute top-3 left-3 rounded-[8px] bg-card px-2 py-1 text-[12px] font-medium shadow-island"
        >
          {COPY.layers.names[layer]}
        </p>
      </PitchFrame>
      <fieldset>
        <legend className="sr-only">{COPY.layers.group}</legend>
        <div className="flex flex-wrap gap-1 rounded-[14px] bg-card p-1 shadow-island">
          {(['auto', ...LAYER_KEYS] as const).map((key) => (
            <label
              className="relative flex h-9 cursor-pointer items-center rounded-[10px] px-3 text-[13px] font-medium text-muted-foreground transition-[background-color,color,scale] duration-150 ease-(--ease-out) select-none has-checked:bg-foreground has-checked:text-background has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring active:scale-[0.97] pointer-fine:hover:text-foreground pointer-fine:has-checked:hover:text-background"
              key={key}
            >
              <input
                checked={pinned === key}
                className="sr-only"
                name={name}
                onChange={() => setPinned(key)}
                type="radio"
                value={key}
              />
              {key === 'auto' ? COPY.layers.auto : COPY.layers.names[key]}
            </label>
          ))}
        </div>
      </fieldset>
      <figcaption className="text-[13px] text-muted-foreground">{COPY.layers.figure}</figcaption>
    </figure>
  )
}

const EVEN = 0.5

function Bar({ l, r }: { l: number; r: number }) {
  const total = l + r
  const share = total === 0 ? EVEN : l / total
  const width = useMemo<CSSProperties>(() => ({ width: `${share * PERCENT}%` }), [share])
  return (
    <div
      aria-hidden
      className={cn(
        'flex h-1 overflow-hidden rounded-full',
        total === 0 ? 'bg-muted' : 'bg-(--team-r)/80',
      )}
    >
      {total === 0 ? null : <span className="h-full bg-(--team-l)" style={width} />}
    </div>
  )
}

/** The team comparison of the clip, computed in the page from the clip itself. */
export function StatsDemo({ clip }: { clip: Clip | null }) {
  const rows = useMemo(() => (clip === null ? [] : comparisonRows(clip.analysis)), [clip])
  return (
    <figure className="flex flex-col gap-3">
      <div className="rounded-[18px] bg-card p-5 shadow-island">
        <div className="mb-4 flex items-center justify-between text-[13px] font-medium">
          <span className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full bg-(--team-l)" />
            {clip?.match.leftName ?? 'HELIOS2026'}
          </span>
          <span className="flex items-center gap-2">
            {clip?.match.rightName ?? 'YuShan2026'}
            <span aria-hidden className="size-2 rounded-full bg-(--team-r)" />
          </span>
        </div>
        <ul className="flex min-h-[260px] flex-col gap-3">
          {rows.map((row) => (
            <li className="flex flex-col gap-1.5" key={row.label}>
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="font-mono tabular-nums">{row.text.l}</span>
                <span className="text-[12px] text-muted-foreground">{row.label}</span>
                <span className="font-mono tabular-nums">{row.text.r}</span>
              </div>
              <Bar l={row.l} r={row.r} />
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-[13px] text-muted-foreground">{COPY.stats.figure}</figcaption>
    </figure>
  )
}
