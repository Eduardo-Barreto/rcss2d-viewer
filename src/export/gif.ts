import { type GifPalette, GIFEncoder, applyPalette, quantize } from 'gifenc'

/** Colors the quantizer may pick; the 256th slot is the transparent index. */
const COLORS = 255
const FORMAT = 'rgb565'
/** GIF disposal 1: leave the frame in place, so the next one only paints what changed. */
const KEEP = 1
const LOOP_FOREVER = 0

/** Appends RGBA frames to an animated GIF. */
export interface GifWriter {
  add: (rgba: Uint8ClampedArray) => void
  finish: () => Uint8Array
}

/**
 * One color table for the whole clip, quantized from a few sample frames. The pitch is a
 * handful of flat colors plus antialiasing, so 255 colors cover every frame.
 */
export function gifPalette(samples: readonly Uint8ClampedArray[]): GifPalette {
  const size = samples.reduce((sum, sample) => sum + sample.length, 0)
  const all = new Uint8ClampedArray(size)
  let at = 0
  for (const sample of samples) {
    all.set(sample, at)
    at += sample.length
  }
  return quantize(all, COLORS, { format: FORMAT })
}

/**
 * A GIF writer for `width` by `height` frames shown `delayMs` each, looping forever. Pixels that
 * did not change since the previous frame are written as transparent, which LZW squeezes into
 * almost nothing: most of the pitch stays still between two cycles.
 */
export function gifWriter(
  width: number,
  height: number,
  delayMs: number,
  palette: GifPalette,
): GifWriter {
  const clear = palette.length
  const table = [...palette, palette[0] ?? [0, 0, 0]]
  const gif = GIFEncoder()
  let previous: Uint8Array | null = null
  return {
    add(rgba) {
      const index = applyPalette(rgba, palette, FORMAT)
      if (previous === null) {
        gif.writeFrame(index, width, height, {
          palette: table,
          delay: delayMs,
          repeat: LOOP_FOREVER,
          dispose: KEEP,
        })
      } else {
        const changed = new Uint8Array(index.length)
        for (let i = 0; i < index.length; i++) {
          const value = index[i] ?? clear
          changed[i] = value === previous[i] ? clear : value
        }
        gif.writeFrame(changed, width, height, {
          delay: delayMs,
          transparent: true,
          transparentIndex: clear,
          dispose: KEEP,
        })
      }
      previous = index
    },
    finish() {
      gif.finish()
      return gif.bytes()
    },
  }
}
