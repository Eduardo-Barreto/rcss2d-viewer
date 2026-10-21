/**
 * Applies the stored theme before the first paint. next-themes injects the same logic as an
 * inline script, which the CSP blocks, so without this a dark-mode visitor sees a light flash.
 * Keep the storage key and class names in sync with the ThemeProvider in src/main.tsx.
 */
;(() => {
  const root = document.documentElement
  let theme = 'system'
  try {
    theme = localStorage.getItem('theme') ?? 'system'
  } catch {
    // Storage can be blocked; the system preference still applies.
  }
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  if (theme !== 'light' && theme !== 'dark') return
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme
})()
