import { useEffect } from 'react'

import { useReplay } from '@/player/store'

/** Longest gap one animation frame may advance, so a backgrounded tab does not jump ahead. */
const MAX_TICK_MS = 250

/** Drives the playhead with animation frames while the replay plays. */
export function usePlayback(): void {
  const playing = useReplay((s) => s.playing)
  useEffect(() => {
    if (!playing) return undefined
    let handle = 0
    let previous = performance.now()
    const tick = (now: number) => {
      useReplay.getState().advance(Math.min(now - previous, MAX_TICK_MS))
      previous = now
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [playing])
}
