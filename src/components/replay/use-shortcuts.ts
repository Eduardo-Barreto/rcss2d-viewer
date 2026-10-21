import { useEffect } from 'react'

import { ZOOM_STEP, useCamera } from '@/player/camera-store'
import { type KeyAction, LONG_STEP_SECONDS, keyAction } from '@/player/keys'
import { type Moment, momentJump } from '@/player/moments'
import { useReplay } from '@/player/store'

const MS_PER_SECOND = 1000
const GOALS = new Set(['goal'] as const)
const REPEATABLE = new Set<KeyAction>([
  'back',
  'forward',
  'backLong',
  'forwardLong',
  'zoomIn',
  'zoomOut',
])

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function longStep(): number {
  const stepMs = useReplay.getState().analysis?.physics.stepMs ?? MS_PER_SECOND
  return Math.round((LONG_STEP_SECONDS * MS_PER_SECOND) / stepMs)
}

function jump(moments: Moment[], direction: 1 | -1, kinds?: ReadonlySet<Moment['kind']>): void {
  const { frame, seek } = useReplay.getState()
  const target = momentJump(moments, frame, direction, kinds)
  if (target !== null) seek(target)
}

function handlers(moments: Moment[], toggleHelp: () => void): Record<KeyAction, () => void> {
  const replay = useReplay.getState
  const camera = useCamera.getState
  const last = () => (replay().match?.frames.count ?? 1) - 1
  return {
    play: () => replay().togglePlay(),
    back: () => replay().step(-1),
    forward: () => replay().step(1),
    backLong: () => replay().step(-longStep()),
    forwardLong: () => replay().step(longStep()),
    slower: () => replay().shiftSpeed(-1),
    faster: () => replay().shiftSpeed(1),
    nextMoment: () => jump(moments, 1),
    previousMoment: () => jump(moments, -1),
    nextGoal: () => jump(moments, 1, GOALS),
    start: () => replay().seek(0),
    end: () => replay().seek(last()),
    fit: () => camera().refit(),
    zoomIn: () => camera().zoomBy(ZOOM_STEP),
    zoomOut: () => camera().zoomBy(1 / ZOOM_STEP),
    follow: () => replay().setFollow(replay().follow === 'ball' ? 'off' : 'ball'),
    panel: () => replay().setPanelOpen(!replay().panelOpen),
    deselect: () => replay().select(-1),
    help: toggleHelp,
    trails: () => replay().toggleOverlay('trails'),
    cones: () => replay().toggleOverlay('cones'),
    offside: () => replay().toggleOverlay('offside'),
    heatmap: () => replay().toggleOverlay('heatmap'),
    stamina: () => replay().toggleOverlay('stamina'),
  }
}

/** Binds the replay shortcuts to the window while a match is open. */
export function useShortcuts(moments: Moment[], toggleHelp: () => void): void {
  useEffect(() => {
    const actions = handlers(moments, toggleHelp)
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || typing(event.target)) return
      const action = keyAction(event)
      if (action === null || (event.repeat && !REPEATABLE.has(action))) return
      event.preventDefault()
      actions[action]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moments, toggleHelp])
}
