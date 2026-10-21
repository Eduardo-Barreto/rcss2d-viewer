/** Something a key press asks the replay to do. */
export type KeyAction =
  | 'play'
  | 'back'
  | 'forward'
  | 'backLong'
  | 'forwardLong'
  | 'slower'
  | 'faster'
  | 'nextMoment'
  | 'previousMoment'
  | 'nextGoal'
  | 'start'
  | 'end'
  | 'fit'
  | 'zoomIn'
  | 'zoomOut'
  | 'follow'
  | 'panel'
  | 'deselect'
  | 'help'
  | 'trails'
  | 'cones'
  | 'offside'
  | 'heatmap'
  | 'stamina'

/** The parts of a `KeyboardEvent` the map reads. */
export interface KeyPress {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

/** One row of the help sheet: the combos that do it, each combo the keys pressed together. */
export interface Shortcut {
  keys: readonly (readonly string[])[]
  label: string
}

/** Seconds one Shift+arrow press moves. */
export const LONG_STEP_SECONDS = 10

const PLAIN: Record<string, KeyAction> = {
  ' ': 'play',
  k: 'play',
  ArrowLeft: 'back',
  ArrowRight: 'forward',
  '[': 'slower',
  ']': 'faster',
  e: 'nextMoment',
  g: 'nextGoal',
  Home: 'start',
  End: 'end',
  '0': 'fit',
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  f: 'follow',
  i: 'panel',
  Escape: 'deselect',
  '?': 'help',
  t: 'trails',
  v: 'cones',
  o: 'offside',
  h: 'heatmap',
  s: 'stamina',
}

const SHIFTED: Record<string, KeyAction> = {
  ArrowLeft: 'backLong',
  ArrowRight: 'forwardLong',
  e: 'previousMoment',
}

/** What a key press means, or null when it is not a replay shortcut. */
export function keyAction(press: KeyPress): KeyAction | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null
  const key = press.key.length === 1 ? press.key.toLowerCase() : press.key
  if (press.shiftKey) {
    const shifted = SHIFTED[key]
    if (shifted !== undefined) return shifted
  }
  return PLAIN[key] ?? null
}

/** The help sheet, in the order people look for things. */
export const SHORTCUTS: readonly Shortcut[] = [
  { keys: [['Espaço'], ['K']], label: 'Reproduzir ou pausar' },
  { keys: [['←'], ['→']], label: 'Um quadro' },
  {
    keys: [
      ['Shift', '←'],
      ['Shift', '→'],
    ],
    label: `${LONG_STEP_SECONDS} segundos`,
  },
  { keys: [['['], [']']], label: 'Mais devagar, mais rápido' },
  { keys: [['E'], ['Shift', 'E']], label: 'Próximo lance, lance anterior' },
  { keys: [['G']], label: 'Próximo gol' },
  { keys: [['Home'], ['End']], label: 'Começo e fim' },
  { keys: [['+'], ['−'], ['0']], label: 'Zoom e enquadrar o campo' },
  { keys: [['F']], label: 'Seguir a bola' },
  {
    keys: [['T'], ['V'], ['O'], ['H'], ['S']],
    label: 'Rastros, visão, impedimento, calor, fôlego',
  },
  { keys: [['I']], label: 'Mostrar ou esconder o painel' },
  { keys: [['Esc']], label: 'Soltar o jogador escolhido' },
  { keys: [['?']], label: 'Esta lista' },
]
