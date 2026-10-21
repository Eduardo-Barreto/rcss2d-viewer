import {
  BALL_STRIDE,
  COUNTERS,
  type FrameColumns,
  SLOT_COUNT,
  SLOT_FLOATS,
  type SlotFloat,
} from './types'

const INITIAL_CAPACITY = 1024
const NO_SLOT = -1

type Column = Float32Array | Int32Array | Int8Array | Uint8Array | Uint16Array | Uint32Array

/** How one column is laid out: values per frame and the value of an empty frame. */
interface ColumnShape {
  stride: number
  empty: number
}

const PER_FRAME: ColumnShape = { stride: 1, empty: 0 }
const PER_SLOT: ColumnShape = { stride: SLOT_COUNT, empty: 0 }
const PER_SLOT_UNSET: ColumnShape = { stride: SLOT_COUNT, empty: NO_SLOT }

/** Rebuilds one column, given its current array and its shape. */
type ColumnMap = <T extends Column>(column: T, shape: ColumnShape) => T

function make<T extends Column>(column: T, length: number): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every typed array constructor returns its own type
  return new (column.constructor as new (length: number) => T)(length)
}

/**
 * Runs a typed array method that returns an array of the receiver's own kind (`fill`, `slice`,
 * `subarray`, `copyWithin`), keeping that kind in the type.
 */
function keep<T extends Column>(column: T, method: (column: Column) => Column): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- these methods return the receiver's own type
  return method(column) as T
}

/** Builds one Float32Array per {@link SlotFloat}, spelled out so the record type is exact. */
function mapSlotFloats(build: (name: SlotFloat) => Float32Array): Record<SlotFloat, Float32Array> {
  return {
    x: build('x'),
    y: build('y'),
    vx: build('vx'),
    vy: build('vy'),
    body: build('body'),
    neck: build('neck'),
    pointX: build('pointX'),
    pointY: build('pointY'),
    viewWidth: build('viewWidth'),
    focusDist: build('focusDist'),
    focusDir: build('focusDir'),
    stamina: build('stamina'),
    effort: build('effort'),
    recovery: build('recovery'),
    capacity: build('capacity'),
  }
}

/** Applies `map` to every column of `frames`, the single place that lists their shapes. */
function mapColumns(frames: FrameColumns, count: number, map: ColumnMap): FrameColumns {
  return {
    count,
    cycle: map(frames.cycle, PER_FRAME),
    playmode: map(frames.playmode, PER_FRAME),
    scoreLeft: map(frames.scoreLeft, PER_FRAME),
    scoreRight: map(frames.scoreRight, PER_FRAME),
    ball: map(frames.ball, { stride: BALL_STRIDE, empty: 0 }),
    players: mapSlotFloats((name) => map(frames.players[name], PER_SLOT)),
    type: map(frames.type, PER_SLOT_UNSET),
    state: map(frames.state, PER_SLOT),
    viewHigh: map(frames.viewHigh, PER_SLOT),
    focusTarget: map(frames.focusTarget, PER_SLOT_UNSET),
    counts: map(frames.counts, { stride: SLOT_COUNT * COUNTERS.length, empty: 0 }),
  }
}

/** Calls `visit` with each column of `target` next to the same column of `source`. */
function eachColumn(
  target: FrameColumns,
  source: FrameColumns,
  visit: (target: Column, source: Column, shape: ColumnShape) => void,
): void {
  const sources: Column[] = []
  mapColumns(source, source.count, (column) => {
    sources.push(column)
    return column
  })
  let i = 0
  mapColumns(target, target.count, (column, shape) => {
    const from = sources[i++]
    if (from !== undefined) visit(column, from, shape)
    return column
  })
}

function emptyColumns(capacity: number): FrameColumns {
  const blank: FrameColumns = {
    count: 0,
    cycle: new Int32Array(0),
    playmode: new Uint8Array(0),
    scoreLeft: new Uint16Array(0),
    scoreRight: new Uint16Array(0),
    ball: new Float32Array(0),
    players: mapSlotFloats(() => new Float32Array(0)),
    type: new Int8Array(0),
    state: new Uint32Array(0),
    viewHigh: new Uint8Array(0),
    focusTarget: new Int8Array(0),
    counts: new Uint32Array(0),
  }
  return mapColumns(blank, 0, (column, shape) =>
    keep(make(column, capacity * shape.stride), (fresh) => fresh.fill(shape.empty)),
  )
}

/**
 * Growable {@link FrameColumns}. Capacity doubles, so a 6000-cycle match reallocates a dozen
 * times instead of once per line. The file parser, the live parser and the page that receives a
 * live match all keep their frames in one of these.
 */
export class FrameStore {
  count = 0
  private capacity = INITIAL_CAPACITY
  columns: FrameColumns = emptyColumns(INITIAL_CAPACITY)

  private readonly maxFrames: number

  constructor(maxFrames: number) {
    this.maxFrames = maxFrames
  }

  /** Reserves the next frame and returns its index. Returns -1 past the frame limit. */
  add(): number {
    if (this.count >= this.maxFrames) return -1
    if (this.count === this.capacity) this.resize(this.capacity * 2)
    return this.count++
  }

  /** Drops the frame reserved last, for a show line that failed half way. */
  dropLast(): void {
    this.count--
    this.clear(this.count)
  }

  /** Puts frame `frame` back to the empty state, as if no show had been read into it. */
  private clear(frame: number): void {
    mapColumns(this.columns, this.count, (column, { stride, empty }) =>
      keep(column, (c) => c.fill(empty, frame * stride, (frame + 1) * stride)),
    )
  }

  /** Copies frame `from` over frame `to`, leaving `from` as it was. */
  copyFrame(from: number, to: number): void {
    mapColumns(this.columns, this.count, (column, { stride }) =>
      keep(column, (c) => c.copyWithin(to * stride, from * stride, (from + 1) * stride)),
    )
  }

  /**
   * Writes `frames` starting at frame `at`, growing as needed. Frames past the end of what is
   * written are dropped, so a resent tail replaces the old one.
   * @returns false when the result would pass the frame limit
   */
  write(at: number, frames: FrameColumns): boolean {
    const end = at + frames.count
    if (at > this.count || end > this.maxFrames) return false
    let capacity = this.capacity
    while (capacity < end) capacity *= 2
    if (capacity !== this.capacity) this.resize(capacity)
    for (let frame = end; frame < this.count; frame++) this.clear(frame)
    eachColumn(this.columns, frames, (target, source, { stride }) => {
      target.set(source.subarray(0, frames.count * stride), at * stride)
    })
    this.count = end
    return true
  }

  private resize(capacity: number): void {
    this.columns = mapColumns(this.columns, this.count, (column, { stride, empty }) => {
      const next = make(column, capacity * stride)
      next.set(column)
      return keep(next, (fresh) => fresh.fill(empty, column.length))
    })
    this.capacity = capacity
  }

  /** Copies frames `from` up to `to`, exclusive, into their own buffers. */
  slice(from: number, to = this.count): FrameColumns {
    return mapColumns(this.columns, to - from, (column, { stride }) =>
      keep(column, (c) => c.slice(from * stride, to * stride)),
    )
  }

  /** Views of the frames read so far, sharing memory with the store until it grows again. */
  view(): FrameColumns {
    const n = this.count
    return mapColumns(this.columns, n, (column, { stride }) =>
      keep(column, (c) => c.subarray(0, n * stride)),
    )
  }

  /** Trims every column to the frames actually read. */
  finish(): FrameColumns {
    return this.slice(0)
  }
}

/** The transferable buffers behind a {@link FrameColumns}, for `postMessage`. */
export function frameBuffers(frames: FrameColumns): ArrayBuffer[] {
  const columns: Column[] = [
    frames.cycle,
    frames.playmode,
    frames.scoreLeft,
    frames.scoreRight,
    frames.ball,
    frames.type,
    frames.state,
    frames.viewHigh,
    frames.focusTarget,
    frames.counts,
    ...SLOT_FLOATS.map((name) => frames.players[name]),
  ]
  return columns.flatMap((column) => (column.buffer instanceof ArrayBuffer ? [column.buffer] : []))
}
