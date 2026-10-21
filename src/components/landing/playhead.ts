import type { FrameWindow } from './clip-windows'

/** Real time the last frame stays on screen before the loop starts over. */
export const END_HOLD_MS = 1500

/** Longest step one paint may take, so a slow or throttled frame never skips the play. */
const MAX_ELAPSED_MS = 100

/**
 * Moves a looping playhead on by `elapsedMs` of real time at 1× speed. Past `span.to` it keeps
 * counting for {@link END_HOLD_MS}, which {@link shownFrame} paints as the last frame, and then
 * wraps to `span.from`.
 */
export function nextFrame(
  frame: number,
  elapsedMs: number,
  stepMs: number,
  span: FrameWindow,
): number {
  const step = Math.min(Math.max(elapsedMs, 0), MAX_ELAPSED_MS) / Math.max(stepMs, 1)
  const next = frame + step
  const end = span.to + END_HOLD_MS / Math.max(stepMs, 1)
  return next > end ? span.from : next
}

/** The frame to paint for a playhead that may be holding past the end of its span. */
export function shownFrame(frame: number, span: FrameWindow): number {
  return Math.min(Math.max(frame, span.from), span.to)
}
