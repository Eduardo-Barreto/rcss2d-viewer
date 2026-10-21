import { type Analysis, analyzeMatch } from '@/analysis/analyze'
import { type Moment, momentsOf } from '@/player/moments'
import { loadMatch } from '@/rcg/load'
import type { Match } from '@/rcg/types'

import { type FrameWindow, clipWindows } from './clip-windows'
import clipUrl from './clip/robocup2026-final.rcg.gz?url'

/** File name the example match opens under in the app. */
export const CLIP_NAME = 'robocup2026-final-gol.rcg.gz'

/** The example match, read and analyzed once for every demo on the page. */
export interface Clip {
  match: Match
  analysis: Analysis
  moments: Moment[]
  /** The play the hero loops: the free kick, the two shots and the goal. */
  hero: FrameWindow
  /** Every frame of the clip, for the demos that show the whole stretch. */
  whole: FrameWindow
}

/** Reads raw clip bytes into a {@link Clip}. */
async function clipOf(bytes: Blob): Promise<Clip> {
  const match = await loadMatch({ kind: 'file', file: bytes, name: CLIP_NAME }, () => undefined)
  const analysis = analyzeMatch(match)
  return { match, analysis, moments: momentsOf(match, analysis), ...clipWindows(match) }
}

let pending: Promise<Clip> | null = null

async function fetchClip(): Promise<Clip> {
  const response = await fetch(clipUrl)
  if (!response.ok) throw new Error(`clip: HTTP ${response.status}`)
  return clipOf(await response.blob())
}

/** The example clip, fetched and parsed on first use and shared after that. A failure is retried. */
export async function loadClip(): Promise<Clip> {
  pending ??= fetchClip()
  try {
    return await pending
  } catch (error) {
    pending = null
    throw error
  }
}
