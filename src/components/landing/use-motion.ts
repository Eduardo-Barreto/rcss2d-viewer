import { type RefObject, useEffect, useState } from 'react'

const REDUCE = '(prefers-reduced-motion: reduce)'
const NEAR_VIEW = '200px 0px'

/** Whether the person asked the system for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCE).matches)
  useEffect(() => {
    const query = window.matchMedia(REDUCE)
    const change = () => setReduced(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return reduced
}

/** Whether the element is on screen (or about to be) in a visible tab. */
export function useVisible(target: RefObject<Element | null>): boolean {
  const [onScreen, setOnScreen] = useState(false)
  const [shown, setShown] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const element = target.current
    if (element === null) return undefined
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: NEAR_VIEW },
    )
    observer.observe(element)
    const change = () => setShown(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', change)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', change)
    }
  }, [target])
  return onScreen && shown
}
