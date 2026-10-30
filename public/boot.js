/**
 * Hides the prerendered text of `#root` while the bundle boots, so a visitor with JavaScript does
 * not see it flash and get replaced. Without JavaScript this never runs and the text stays. The
 * app drops the class once it mounts (`useBooted`); the timer shows the text if it never does.
 * The hiding rule is the inline `<style>` in `index.html`, a plain `display: none` that lasts at
 * most four seconds.
 * Keep the class name in sync with `src/lib/booted.ts`.
 */
;(() => {
  const FALLBACK_MS = 4000
  const root = document.documentElement
  root.classList.add('booting')
  setTimeout(() => root.classList.remove('booting'), FALLBACK_MS)
})()
