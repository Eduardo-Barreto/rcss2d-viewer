/** What {@link readGif} finds in a GIF: the screen size and each frame's delay. */
export interface GifSummary {
  width: number
  height: number
  delaysMs: number[]
  transparentFrames: number
}

const HEADER = 6
const SCREEN = 7
const IMAGE = 0x2c
const EXTENSION = 0x21
const CONTROL = 0xf9
const TRAILER = 0x3b
const CENTISECOND = 10
const HAS_TABLE = 0x80
const TABLE_BITS = 7
const RGB = 3
/** Offsets inside the blocks this reader looks at. */
const SCREEN_PACKED = 4
const CONTROL_FLAGS = 3
const CONTROL_DELAY = 4
const IMAGE_PACKED = 9
const IMAGE_HEADER = 10

function skipBlocks(bytes: Uint8Array, at: number): number {
  let i = at
  while ((bytes[i] ?? 0) !== 0) i += (bytes[i] ?? 0) + 1
  return i + 1
}

function tableSize(packed: number): number {
  return packed & HAS_TABLE ? RGB * 2 ** ((packed & TABLE_BITS) + 1) : 0
}

function readControl(bytes: Uint8Array, view: DataView, at: number, summary: GifSummary): void {
  if (bytes[at + 1] !== CONTROL) return
  summary.delaysMs.push(view.getUint16(at + CONTROL_DELAY, true) * CENTISECOND)
  if ((bytes[at + CONTROL_FLAGS] ?? 0) & 1) summary.transparentFrames++
}

function nextBlock(bytes: Uint8Array, view: DataView, at: number, summary: GifSummary): number {
  const kind = bytes[at]
  if (kind === EXTENSION) {
    readControl(bytes, view, at, summary)
    return skipBlocks(bytes, at + 2)
  }
  if (kind === IMAGE) {
    return skipBlocks(bytes, at + IMAGE_HEADER + tableSize(bytes[at + IMAGE_PACKED] ?? 0) + 1)
  }
  throw new Error(`unexpected GIF block ${String(kind)} at ${at}`)
}

/** Walks the blocks of a GIF89a, enough for tests to check what the encoder wrote. */
export function readGif(bytes: Uint8Array): GifSummary {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (new TextDecoder().decode(bytes.subarray(0, HEADER)) !== 'GIF89a') {
    throw new Error('not a GIF89a')
  }
  const summary: GifSummary = {
    width: view.getUint16(HEADER, true),
    height: view.getUint16(HEADER + 2, true),
    delaysMs: [],
    transparentFrames: 0,
  }
  let i = HEADER + SCREEN + tableSize(bytes[HEADER + SCREEN_PACKED] ?? 0)
  while (bytes[i] !== TRAILER) i = nextBlock(bytes, view, i, summary)
  return summary
}
