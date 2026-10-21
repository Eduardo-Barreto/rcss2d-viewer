import { useSyncExternalStore } from 'react'

const NARROW = '(max-width: 720px)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(NARROW)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** True on phone-sized screens, where the panel becomes a bottom sheet. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches)
}
