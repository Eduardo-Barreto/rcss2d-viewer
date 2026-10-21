/** Colors the canvas draws with, read from the CSS custom properties of the theme. */
export interface Palette {
  background: string
  pitch: string
  line: string
  teamL: string
  teamR: string
  inkL: string
  inkR: string
  ball: string
  ballRing: string
  foreground: string
  muted: string
  ring: string
  goal: string
  shot: string
  foul: string
  card: string
}

const FALLBACK = '#888'

/** Reads the palette of the current theme from `element`. */
export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element)
  const read = (name: string) => style.getPropertyValue(name).trim() || FALLBACK
  return {
    background: read('--background'),
    pitch: read('--pitch'),
    line: read('--pitch-line'),
    teamL: read('--team-l'),
    teamR: read('--team-r'),
    inkL: read('--team-l-ink'),
    inkR: read('--team-r-ink'),
    ball: read('--ball'),
    ballRing: read('--ball-ring'),
    foreground: read('--foreground'),
    muted: read('--muted-foreground'),
    ring: read('--ring'),
    goal: read('--event-goal'),
    shot: read('--event-shot'),
    foul: read('--event-foul'),
    card: read('--event-card'),
  }
}
