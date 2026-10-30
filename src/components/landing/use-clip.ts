import { useEffect, useMemo, useState } from 'react'

import { type MomentLabels, momentsOf } from '@/player/moments'

import { type Clip, loadClip } from './clip'

/** What the page knows about the example clip. */
export interface ClipState {
  clip: Clip | null
  failed: boolean
}

/**
 * The example clip, shared by every demo; `null` until it is read. Moments are worded with
 * `labels` when given, and in the replay app's own words otherwise.
 */
export function useClip(labels: MomentLabels | null = null): ClipState {
  const [state, setState] = useState<ClipState>({ clip: null, failed: false })
  useEffect(() => {
    let live = true
    const read = async () => {
      try {
        const clip = await loadClip()
        if (live) setState({ clip, failed: false })
      } catch {
        if (live) setState({ clip: null, failed: true })
      }
    }
    void read()
    return () => {
      live = false
    }
  }, [])
  return useMemo(() => {
    const { clip } = state
    if (clip === null || labels === null) return state
    return { ...state, clip: { ...clip, moments: momentsOf(clip.match, clip.analysis, labels) } }
  }, [state, labels])
}
