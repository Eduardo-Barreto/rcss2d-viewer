import { FrameStore } from './columns'
import { DEFAULT_LIMITS, type MatchDelta, clampTo } from './parser'
import { RcgError } from './scanner'
import type { Match } from './types'

/** Log version the live match reports, the one whose lines a monitor receives. */
const LIVE_VERSION = 6

/**
 * The page's copy of a match that is still being played. Each {@link MatchDelta} from the
 * worker lands in the same growing columns, so a new batch costs its own frames and not a copy
 * of the whole match.
 */
export class LiveMatch {
  private readonly store: FrameStore
  private match: Omit<Match, 'frames'> = {
    version: LIVE_VERSION,
    leftName: '',
    rightName: '',
    playmodes: [],
    scores: [],
    messages: [],
    graphics: { l: [], r: [] },
    serverParams: new Map(),
    playerParams: new Map(),
    playerTypes: [],
    skippedLines: 0,
  }

  constructor(maxFrames = DEFAULT_LIMITS.maxFrames) {
    this.store = new FrameStore(maxFrames)
  }

  /** Frames received so far. */
  get count(): number {
    return this.store.count
  }

  /**
   * Adds a batch and returns the match as it stands, a new object each time so React sees
   * the change, or null while no frame has arrived. Fails when the batch does not follow the
   * frames already held.
   */
  apply(delta: MatchDelta): Match | null {
    if (!this.store.write(delta.from, delta.frames)) {
      throw new RcgError('Os quadros ao vivo chegaram fora de ordem.')
    }
    const m = this.match
    this.match = {
      ...m,
      leftName: delta.leftName,
      rightName: delta.rightName,
      playmodes: [...m.playmodes, ...delta.playmodes],
      scores: [...m.scores, ...delta.scores],
      messages: [...m.messages, ...delta.messages],
      graphics: delta.graphics ?? m.graphics,
      ...delta.params,
      skippedLines: delta.skippedLines,
    }
    if (this.store.count === 0) return null
    const last = this.store.count - 1
    return {
      ...this.match,
      frames: this.store.view(),
      playmodes: clampTail(this.match.playmodes, last),
      scores: clampTail(this.match.scores, last),
      messages: clampTail(this.match.messages, last),
    }
  }
}

/**
 * Pulls the entries that point past the last frame back onto it. Entries are in frame order,
 * so only the tail can be past it and the rest is shared, not copied one by one.
 */
function clampTail<T extends { frame: number }>(entries: T[], last: number): T[] {
  let start = entries.length
  while (start > 0 && (entries[start - 1]?.frame ?? 0) > last) start--
  if (start === entries.length) return entries
  return [...entries.slice(0, start), ...entries.slice(start).map(clampTo(last))]
}
