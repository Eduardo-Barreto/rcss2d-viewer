import { useEffect, useState } from 'react'

import { type Clip, loadClip } from './clip'

/** What the page knows about the example clip. */
export interface ClipState {
  clip: Clip | null
  failed: boolean
}

/** The example clip, shared by every demo; `null` until it is read. */
export function useClip(): ClipState {
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
  return state
}
