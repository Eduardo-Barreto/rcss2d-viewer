import { useEffect } from 'react'

/** Class `public/boot.js` puts on `<html>` to hide the prerendered text until the app mounts. */
export const BOOTING_CLASS = 'booting'

/** Shows the page once the app has mounted: removes the class that hides the prerendered text. */
export function useBooted(): void {
  useEffect(() => {
    document.documentElement.classList.remove(BOOTING_CLASS)
  }, [])
}
