import type { Analysis } from '@/analysis/analyze'
import type { Match } from '@/rcg/types'
import type { Palette } from '@/render/palette'

import { CLIP_WIDTH, type ClipRange, clipRange, clipSize, drawClipFrame } from './clip'
import { gifPalette, gifWriter } from './gif'

const YIELD_EVERY = 10
const PALETTE_SAMPLES = 4
const SWATCH_PX = 16

/** What {@link exportClipGif} needs. */
export interface ClipOptions {
  match: Match
  analysis: Analysis
  palette: Palette
  /** First and last cycle, inclusive. */
  from: number
  to: number
  /** Width in pixels; the height follows the pitch. */
  width?: number
  /** Called after each frame with how many are done. */
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

/** An exported clip. */
export interface ClipResult extends ClipRange {
  gif: Uint8Array
  width: number
  height: number
}

function stopIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new DOMException('Exportação cancelada.', 'AbortError')
}

function yieldToPage(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * One square of every theme color. Colors that only show up in a few frames (a foul ring, a
 * card) may miss the sampled frames, and the swatches keep them in the color table anyway.
 */
function paintSwatches(ctx: CanvasRenderingContext2D, palette: Palette): Uint8ClampedArray {
  const table: Record<keyof Palette, string> = palette
  const colors = Object.values(table)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  colors.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(i * SWATCH_PX, 0, SWATCH_PX, SWATCH_PX)
  })
  return ctx.getImageData(0, 0, colors.length * SWATCH_PX, SWATCH_PX).data
}

function sampleFrames(range: ClipRange): number[] {
  const last = range.count - 1
  return Array.from({ length: PALETTE_SAMPLES }, (_, i) =>
    Math.round(range.start + (last * i) / (PALETTE_SAMPLES - 1)),
  )
}

/**
 * Renders cycles `from..to` with the app's renderer onto `ctx`, one GIF frame per log frame at
 * the log's own step (100 ms is real time), and returns the GIF. The context's canvas is
 * resized to the clip. It yields to the event loop every few frames, so a page can show
 * progress and abort through `signal`, which is checked before every frame.
 */
export async function exportClipGif(
  ctx: CanvasRenderingContext2D,
  options: ClipOptions,
): Promise<ClipResult> {
  const { match, analysis, palette, signal } = options
  stopIfAborted(signal)
  const range = clipRange(match, options.from, options.to)
  const size = clipSize(options.width ?? CLIP_WIDTH)
  ctx.canvas.width = size.width
  ctx.canvas.height = size.height
  const paint = (frame: number) => {
    drawClipFrame(ctx, { match, analysis, palette, size, frame })
    return ctx.getImageData(0, 0, size.width, size.height).data
  }
  const writer = gifWriter(
    size.width,
    size.height,
    analysis.physics.stepMs,
    gifPalette([paintSwatches(ctx, palette), ...sampleFrames(range).map(paint)]),
  )
  for (let i = 0; i < range.count; i++) {
    stopIfAborted(signal)
    writer.add(paint(range.start + i))
    options.onProgress?.(i + 1, range.count)
    if ((i + 1) % YIELD_EVERY === 0) await yieldToPage()
  }
  stopIfAborted(signal)
  return { ...range, gif: writer.finish(), width: size.width, height: size.height }
}
