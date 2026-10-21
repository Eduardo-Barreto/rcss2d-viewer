import {
  BALL_STRIDE,
  COUNTERS,
  type FrameColumns,
  SLOT_COUNT,
  SLOT_FLOATS,
  type SlotFloat,
} from './types'

const INITIAL_CAPACITY = 1024

type Column = Float32Array | Int32Array | Int8Array | Uint8Array | Uint16Array | Uint32Array

function grow<T extends Column>(column: T, length: number, fill?: number): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- every typed array constructor returns its own type
  const next = new (column.constructor as new (length: number) => T)(length)
  next.set(column)
  if (fill !== undefined) next.fill(fill, column.length)
  return next
}

/** Builds one Float32Array per {@link SlotFloat}, spelled out so the record type is exact. */
function mapSlotFloats(make: (name: SlotFloat) => Float32Array): Record<SlotFloat, Float32Array> {
  return {
    x: make('x'),
    y: make('y'),
    vx: make('vx'),
    vy: make('vy'),
    body: make('body'),
    neck: make('neck'),
    pointX: make('pointX'),
    pointY: make('pointY'),
    viewWidth: make('viewWidth'),
    focusDist: make('focusDist'),
    focusDir: make('focusDir'),
    stamina: make('stamina'),
    effort: make('effort'),
    recovery: make('recovery'),
    capacity: make('capacity'),
  }
}

/**
 * Growable {@link FrameColumns}. Capacity doubles, so a 6000-cycle match reallocates a dozen
 * times instead of once per line.
 */
export class FrameStore {
  count = 0
  private capacity = INITIAL_CAPACITY
  columns: FrameColumns

  private readonly maxFrames: number

  constructor(maxFrames: number) {
    this.maxFrames = maxFrames
    const capacity = INITIAL_CAPACITY
    this.columns = {
      count: 0,
      cycle: new Int32Array(capacity),
      playmode: new Uint8Array(capacity),
      scoreLeft: new Uint16Array(capacity),
      scoreRight: new Uint16Array(capacity),
      ball: new Float32Array(capacity * BALL_STRIDE),
      players: mapSlotFloats(() => new Float32Array(capacity * SLOT_COUNT)),
      type: new Int8Array(capacity * SLOT_COUNT).fill(-1),
      state: new Uint32Array(capacity * SLOT_COUNT),
      viewHigh: new Uint8Array(capacity * SLOT_COUNT),
      focusTarget: new Int8Array(capacity * SLOT_COUNT).fill(-1),
      counts: new Uint32Array(capacity * SLOT_COUNT * COUNTERS.length),
    }
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
    const start = this.count * SLOT_COUNT
    const end = start + SLOT_COUNT
    this.columns.type.fill(-1, start, end)
    this.columns.focusTarget.fill(-1, start, end)
  }

  private resize(capacity: number): void {
    const c = this.columns
    const slots = capacity * SLOT_COUNT
    this.columns = {
      count: c.count,
      cycle: grow(c.cycle, capacity),
      playmode: grow(c.playmode, capacity),
      scoreLeft: grow(c.scoreLeft, capacity),
      scoreRight: grow(c.scoreRight, capacity),
      ball: grow(c.ball, capacity * BALL_STRIDE),
      players: mapSlotFloats((name) => grow(c.players[name], slots)),
      type: grow(c.type, slots, -1),
      state: grow(c.state, slots),
      viewHigh: grow(c.viewHigh, slots),
      focusTarget: grow(c.focusTarget, slots, -1),
      counts: grow(c.counts, slots * COUNTERS.length),
    }
    this.capacity = capacity
  }

  /** Trims every column to the frames actually read. */
  finish(): FrameColumns {
    const n = this.count
    const slots = n * SLOT_COUNT
    const c = this.columns
    return {
      count: n,
      cycle: c.cycle.slice(0, n),
      playmode: c.playmode.slice(0, n),
      scoreLeft: c.scoreLeft.slice(0, n),
      scoreRight: c.scoreRight.slice(0, n),
      ball: c.ball.slice(0, n * BALL_STRIDE),
      players: mapSlotFloats((name) => c.players[name].slice(0, slots)),
      type: c.type.slice(0, slots),
      state: c.state.slice(0, slots),
      viewHigh: c.viewHigh.slice(0, slots),
      focusTarget: c.focusTarget.slice(0, slots),
      counts: c.counts.slice(0, slots * COUNTERS.length),
    }
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
