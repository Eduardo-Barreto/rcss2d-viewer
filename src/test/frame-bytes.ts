import type { FrameColumns } from '../rcg/types.ts'

const bytesOf = (column: ArrayBufferView) =>
  new Uint8Array(column.buffer, column.byteOffset, column.byteLength)

/**
 * The frame columns as raw bytes, for `toEqual`. Bun compares typed arrays element by element
 * with `===`, so a column holding NaN (a player not on the field yet) never equals itself.
 */
export function frameBytes(frames: FrameColumns): Record<string, Uint8Array | number> {
  const { count, players, ...columns } = frames
  const out: Record<string, Uint8Array | number> = { count }
  for (const [key, column] of Object.entries(columns)) out[key] = bytesOf(column)
  for (const [slot, column] of Object.entries(players)) out[`players.${slot}`] = bytesOf(column)
  return out
}
