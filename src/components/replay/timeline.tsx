import { useTheme } from 'next-themes'
import { Slider } from 'radix-ui'
import { useEffect, useMemo, useRef, useState } from 'react'

import { clockOf, cycleAt, frameOfCycle } from '@/player/format'
import type { Moment } from '@/player/moments'
import { useReplay } from '@/player/store'
import { readPalette } from '@/render/palette'
import { type TimelineMark, drawTimeline } from '@/render/timeline'

const HEIGHT_PX = 24
const MARKED = new Set(['goal', 'shot', 'card'])

function isMark(moment: Moment): moment is Moment & { kind: TimelineMark['kind'] } {
  return MARKED.has(moment.kind)
}

function Strip({ moments }: { moments: Moment[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const match = useReplay((s) => s.match)
  const analysis = useReplay((s) => s.analysis)
  const { resolvedTheme } = useTheme()
  const marks = useMemo(() => moments.filter(isMark), [moments])

  useEffect(() => {
    const element = canvas.current
    if (element === null || match === null || analysis === null) return undefined
    const paint = () => {
      const ctx = element.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio || 1
      const { width } = element.getBoundingClientRect()
      element.width = Math.round(width * dpr)
      element.height = Math.round(HEIGHT_PX * dpr)
      const halves: number[] = []
      for (
        let cycle = analysis.physics.halfCycles;
        cycle < (match.frames.cycle[match.frames.count - 1] ?? 0);
        cycle += analysis.physics.halfCycles
      ) {
        halves.push(frameOfCycle(match, cycle))
      }
      drawTimeline(ctx, {
        match,
        analysis,
        marks,
        halves,
        width,
        height: HEIGHT_PX,
        dpr,
        palette: readPalette(document.documentElement),
      })
    }
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(element)
    return () => observer.disconnect()
  }, [match, analysis, marks, resolvedTheme])

  return (
    <canvas
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-6 w-full"
      ref={canvas}
    />
  )
}

/** The scrubber: a slider over the possession strip and the marks, with a hover clock. */
export function Timeline({ moments }: { moments: Moment[] }) {
  const match = useReplay((s) => s.match)
  const stepMs = useReplay((s) => s.analysis?.physics.stepMs ?? 0)
  const frame = useReplay((s) => Math.round(s.frame))
  const seek = useReplay((s) => s.seek)
  const [hover, setHover] = useState<{ x: number; frame: number } | null>(null)
  const value = useMemo(() => [frame], [frame])
  const pill = useMemo(() => ({ left: hover?.x ?? 0 }), [hover])
  if (match === null) return null
  const last = match.frames.count - 1
  const cycle = cycleAt(match, frame)

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    setHover({ x: share * box.width, frame: Math.round(share * last) })
  }

  return (
    <div
      className="relative h-9 w-full"
      onPointerLeave={() => setHover(null)}
      onPointerMove={onMove}
    >
      <Strip moments={moments} />
      <Slider.Root
        className="absolute inset-0 flex touch-none items-end pb-[3px] select-none"
        max={last}
        min={0}
        onValueChange={([next]) => seek(next ?? 0)}
        step={1}
        value={value}
      >
        <Slider.Track className="relative h-[2px] grow rounded-full bg-transparent">
          <Slider.Range className="absolute h-full rounded-full bg-foreground/25" />
        </Slider.Track>
        <Slider.Thumb
          aria-label="Posição na partida"
          aria-valuetext={`${clockOf(cycle, stepMs)}, ciclo ${cycle}`}
          className="block h-7 w-[3px] -translate-y-[-2px] rounded-full bg-foreground shadow-[0_0_0_2px_var(--card)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Slider.Root>
      {hover === null ? null : (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded-[7px] bg-primary px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-primary-foreground tabular-nums"
          style={pill}
        >
          {clockOf(cycleAt(match, hover.frame), stepMs)} · {cycleAt(match, hover.frame)}
        </span>
      )}
    </div>
  )
}
