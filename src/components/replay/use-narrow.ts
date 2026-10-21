import { useCallback, useSyncExternalStore } from 'react'

/** Below this width the islands stack under the scoreboard. Matches the `compact:` variant. */
export const COMPACT = '(max-width: 1100px)'
/** Below this width the panel is a bottom sheet. Matches the `phone:` variant. */
export const PHONE = '(max-width: 720px)'

function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** True on phone-sized screens, where the panel becomes a bottom sheet. */
export function useNarrow(): boolean {
  return useMedia(PHONE)
}

/** True on screens too narrow for the scoreboard and the layers to share the top edge. */
export function useCompact(): boolean {
  return useMedia(COMPACT)
}

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

/** The window's inner height in CSS pixels, kept current on resize. */
export function useViewportHeight(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerHeight)
}
