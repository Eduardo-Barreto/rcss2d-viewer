import { describe, expect, test } from 'bun:test'

import { readGif } from '@/test/gif-reader'

import { gifPalette, gifWriter } from './gif'

const W = 128
const H = 64

function solid(r: number, g: number, b: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < rgba.length; i += 4) rgba.set([r, g, b, 255], i)
  return rgba
}

function noise(seed: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  let state = seed
  for (let i = 0; i < rgba.length; i += 4) {
    state = (state * 1103515245 + 12345) % 2147483648
    const level = (state >> 16) & 1 ? 255 : 0
    rgba.set([level, 255 - level, level, 255], i)
  }
  return rgba
}

function encode(frames: Uint8ClampedArray[]): Uint8Array {
  const writer = gifWriter(W, H, 100, gifPalette(frames))
  for (const frame of frames) writer.add(frame)
  return writer.finish()
}

function grayRamp(): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    const level = (i / 4) % 256
    rgba.set([level, level, (level * 7) % 256, 255], i)
  }
  return rgba
}

function hasNear(palette: number[][], [r, g, b]: [number, number, number]): boolean {
  return palette.some(([pr = 0, pg = 0, pb = 0]) => Math.hypot(pr - r, pg - g, pb - b) < 16)
}

describe('gifPalette', () => {
  test('keeps a color that only a small swatch has', () => {
    const red = new Uint8ClampedArray(16 * 16 * 4)
    for (let i = 0; i < red.length; i += 4) red.set([230, 40, 40, 255], i)
    expect(hasNear(gifPalette([grayRamp()]), [230, 40, 40])).toBe(false)
    expect(hasNear(gifPalette([red, grayRamp()]), [230, 40, 40])).toBe(true)
  })
})

describe('gifWriter', () => {
  test('writes a looping GIF89a with one frame per call at the given delay', () => {
    const gif = readGif(encode([solid(10, 20, 30), solid(200, 100, 0), solid(10, 20, 30)]))
    expect(gif.width).toBe(W)
    expect(gif.height).toBe(H)
    expect(gif.delaysMs).toEqual([100, 100, 100])
  })

  test('writes every frame after the first as a transparent diff', () => {
    expect(readGif(encode([solid(0, 0, 0), solid(255, 255, 255)])).transparentFrames).toBe(1)
  })

  test('a repeated frame costs a fraction of a new one', () => {
    const a = noise(1)
    const b = noise(2)
    const repeated = encode([a, a, a]).length - encode([a]).length
    const changed = encode([a, b, a]).length - encode([a]).length
    expect(repeated * 5).toBeLessThan(changed)
  })
})
