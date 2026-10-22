import { describe, expect, test } from 'bun:test'

import { analyzeMatch } from '@/analysis/analyze'
import { parseRcgText } from '@/rcg/parser'
import { readPalette } from '@/render/palette'
import { readGif } from '@/test/gif-reader'
import { rcgText, showLine } from '@/test/rcg-builder'

import { exportClipGif } from './export'

const match = parseRcgText(
  rcgText(
    ...Array.from({ length: 40 }, (_, i) =>
      showLine(i + 1, [i - 20, 0, 1, 0], [{ side: 'r', unum: 1, x: 50 - i, y: 0 }]),
    ),
  ),
)

function canvas() {
  const sized = { width: 0, height: 0 }
  const ctx = new Proxy(
    { canvas: sized },
    {
      get: (target, name: string) => {
        if (name === 'canvas') return target.canvas
        if (name === 'measureText') return () => ({ width: 10 })
        if (name === 'getImageData')
          return (_x: number, _y: number, w: number, h: number) => ({
            data: new Uint8ClampedArray(w * h * 4),
          })
        return () => undefined
      },
      set: () => true,
    },
  )
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the stub answers every method
  return { ctx: ctx as unknown as CanvasRenderingContext2D, sized }
}

const options = {
  match,
  analysis: analyzeMatch(match),
  palette: readPalette(document.documentElement),
  width: 400,
}

describe('exportClipGif', () => {
  test('writes one frame per log frame at the server step, on a canvas sized to the clip', async () => {
    const { ctx, sized } = canvas()
    const progress: number[] = []
    const clip = await exportClipGif(ctx, {
      ...options,
      from: 5,
      to: 30,
      onProgress: (done) => progress.push(done),
    })
    expect(clip).toMatchObject({ from: 5, to: 30, count: 26, width: 400 })
    expect(sized).toEqual({ width: 400, height: clip.height })
    expect(progress.at(-1)).toBe(26)
    const gif = readGif(clip.gif)
    expect(gif.delaysMs).toHaveLength(26)
    expect(new Set(gif.delaysMs)).toEqual(new Set([100]))
  })

  test('stops when aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const pending = exportClipGif(canvas().ctx, {
      ...options,
      from: 1,
      to: 40,
      signal: controller.signal,
    })
    expect(pending).rejects.toThrow('Exportação cancelada.')
  })
})
