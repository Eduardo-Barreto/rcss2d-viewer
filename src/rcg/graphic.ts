import type { GraphicTile } from './types'

const MAX_TILE_SIDE = 64
const MAX_COLORS = 256
const MAX_CHARS_PER_PIXEL = 2
const MAX_TILE_INDEX = 63
const RGBA = 4
const ALPHA = 3
const OPAQUE = 255
const HEX_COLOR = /^#(?<hex>[0-9a-f]{6})$/i
const BYTE_MASK = 0xff
const RED_SHIFT = 16
const GREEN_SHIFT = 8
const HEADER_FIELDS = 4

/** RGBA of an XPM color, or `null` for `None` and any color form that is not `#RRGGBB`. */
function parseColor(spec: string): [number, number, number] | null {
  const hex = HEX_COLOR.exec(spec)?.groups?.hex
  if (hex === undefined) return null
  const value = Number.parseInt(hex, 16)
  return [(value >> RED_SHIFT) & BYTE_MASK, (value >> GREEN_SHIFT) & BYTE_MASK, value & BYTE_MASK]
}

const inRange = (value: number, max: number) => value > 0 && value <= max

function readHeader(header: string | undefined) {
  const fields = (header ?? '').trim().split(/\s+/).map(Number)
  if (fields.length < HEADER_FIELDS || !fields.every(Number.isInteger)) return null
  const [width = 0, height = 0, colors = 0, cpp = 0] = fields
  const limits = [
    inRange(width, MAX_TILE_SIDE),
    inRange(height, MAX_TILE_SIDE),
    inRange(colors, MAX_COLORS),
    inRange(cpp, MAX_CHARS_PER_PIXEL),
  ]
  return limits.every(Boolean) ? { width, height, colors, cpp } : null
}

function readPalette(lines: string[], colors: number, cpp: number) {
  const palette = new Map<string, [number, number, number] | null>()
  for (let i = 0; i < colors; i++) {
    const line = lines[i] ?? ''
    const key = line.slice(0, cpp)
    const spec = /\sc\s+(?<color>\S+)/.exec(line.slice(cpp))?.groups?.color ?? ''
    palette.set(key, parseColor(spec))
  }
  return palette
}

/**
 * Decodes one XPM tile of a `(team_graphic_<side> (x y "xpm" ...))` message, the shape
 * written by `SerializerMonitorStdv1::serializeTeamGraphic` (rcssserver
 * `src/serializermonitor.cpp:73`). Only `#RRGGBB` and `None` colors are understood; anything
 * else is transparent, so a hostile palette can only produce a blank pixel.
 */
export function decodeTile(x: number, y: number, xpm: string[]): GraphicTile | null {
  if (!inRange(x + 1, MAX_TILE_INDEX + 1) || !inRange(y + 1, MAX_TILE_INDEX + 1)) return null
  const header = readHeader(xpm[0])
  if (header === null) return null
  const { width, height, colors, cpp } = header
  const palette = readPalette(xpm.slice(1), colors, cpp)
  const rows = xpm.slice(1 + colors)
  if (rows.length < height) return null
  const rgba = new Uint8ClampedArray(width * height * RGBA)
  rows.slice(0, height).forEach((text, row) => {
    for (let col = 0; col < width; col++) {
      const color = palette.get(text.slice(col * cpp, (col + 1) * cpp))
      if (!color) continue
      const at = (row * width + col) * RGBA
      rgba.set(color, at)
      rgba[at + ALPHA] = OPAQUE
    }
  })
  return { x, y, width, height, rgba }
}
