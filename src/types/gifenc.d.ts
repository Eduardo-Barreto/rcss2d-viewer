/** Types for the parts of gifenc 1.0.3 the clip export uses (the package ships none). */
declare module 'gifenc' {
  /** A color table: `[r, g, b]` entries, 0 to 255. */
  export type GifPalette = number[][]

  /** Options of {@link GifEncoder.writeFrame}. */
  export interface GifFrameOptions {
    palette?: GifPalette
    transparent?: boolean
    transparentIndex?: number
    delay?: number
    repeat?: number
    dispose?: number
  }

  /** A GIF byte stream that frames are appended to. */
  export interface GifEncoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifFrameOptions): void
    finish(): void
    bytes(): Uint8Array
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoder
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' },
  ): GifPalette
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array
}
