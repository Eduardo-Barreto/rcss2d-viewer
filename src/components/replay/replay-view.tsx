import { useCallback, useEffect, useMemo, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { cycleHash, parseDeepLink } from '@/player/deep-link'
import { cycleAt, frameOfCycle } from '@/player/format'
import { momentsOf } from '@/player/moments'
import { useReplay } from '@/player/store'

import { HelpDialog } from './help-dialog'
import { Layers } from './layers'
import { OpenLog } from './open-log'
import { Panel, PanelToggle } from './panel/panel'
import { type Insets, PitchView } from './pitch-view'
import { Scoreboard } from './scoreboard'
import { Transport } from './transport'
import { useNarrow } from './use-narrow'
import { usePlayback } from './use-playback'
import { useShortcuts } from './use-shortcuts'
import { Zoom } from './zoom'

const PANEL_WIDTH = 340
const EDGE = 12
const TOP_INSET = 64
const TOP_INSET_NARROW = 136
const BOTTOM_INSET = 116
const TOOLTIP_DELAY_MS = 400

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

/** Opens a log dropped anywhere on the window and reports whether a file is over it. */
function useFileDrop(): boolean {
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    let depth = 0
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth++
      setDragging(true)
    }
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      const file = event.dataTransfer?.files[0]
      if (file !== undefined)
        void useReplay.getState().open({ kind: 'file', file, name: file.name })
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [])
  return dragging
}

/** `?url=` opens a log on arrival, `#t=` seeks once it is read, and pausing writes `#t=` back. */
function useDeepLink(): void {
  const match = useReplay((s) => s.match)
  const playing = useReplay((s) => s.playing)

  useEffect(() => {
    const { url } = parseDeepLink(window.location.search, '')
    if (url !== null && useReplay.getState().status === 'empty') {
      void useReplay.getState().open({ kind: 'url', url })
    }
  }, [])

  useEffect(() => {
    if (match === null) return
    const { cycle } = parseDeepLink('', window.location.hash)
    if (cycle !== null) useReplay.getState().seek(frameOfCycle(match, cycle))
  }, [match])

  useEffect(() => {
    if (match === null || playing) return
    const hash = cycleHash(cycleAt(match, useReplay.getState().frame))
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }, [match, playing])
}

function useInsets(narrow: boolean): Insets {
  const panelOpen = useReplay((s) => s.panelOpen)
  const right = !narrow && panelOpen ? PANEL_WIDTH + EDGE * 2 : EDGE
  const top = narrow ? TOP_INSET_NARROW : TOP_INSET
  return useMemo(() => ({ top, right, bottom: BOTTOM_INSET, left: EDGE }), [top, right])
}

function Stage({ narrow }: { narrow: boolean }) {
  const match = useReplay((s) => s.match)
  const analysis = useReplay((s) => s.analysis)
  const panelOpen = useReplay((s) => s.panelOpen)
  const name = useReplay((s) => s.name)
  const [help, setHelp] = useState(false)
  const toggleHelp = useCallback(() => setHelp((open) => !open), [])
  const moments = useMemo(
    () => (match === null || analysis === null ? [] : momentsOf(match, analysis)),
    [match, analysis],
  )
  const insets = useInsets(narrow)
  const rightEdge = useMemo(
    () => ({ right: !narrow && panelOpen ? PANEL_WIDTH + EDGE * 2 : EDGE }),
    [narrow, panelOpen],
  )

  usePlayback()
  useShortcuts(moments, toggleHelp)

  return (
    <main className="fixed inset-0 overflow-hidden bg-(--pitch)">
      <h1 className="sr-only">Replay: {name}</h1>
      <PitchView insets={insets} />
      <Scoreboard className="fixed top-safe-3 left-safe-3 max-[720px]:right-safe-3" />
      <div
        className="fixed top-safe-3 flex justify-end max-[720px]:top-safe-[76px] max-[720px]:left-safe-3"
        style={rightEdge}
      >
        <Layers className="max-w-full overflow-x-auto" onHelp={toggleHelp}>
          <PanelToggle />
        </Layers>
      </div>
      <div className="fixed bottom-safe-3 left-safe-3 flex items-end gap-2" style={rightEdge}>
        <Transport className="min-w-0 flex-1" moments={moments} />
        <Zoom className="max-[720px]:hidden" />
      </div>
      <Panel moments={moments} width={PANEL_WIDTH} />
      <HelpDialog onOpenChange={setHelp} open={help} />
    </main>
  )
}

/** The whole app: the open screen until a log is read, then the replay. */
export function ReplayView() {
  const status = useReplay((s) => s.status)
  const match = useReplay((s) => s.match)
  const narrow = useNarrow()
  const dragging = useFileDrop()
  useDeepLink()

  useEffect(() => {
    if (match !== null && narrow) useReplay.getState().setPanelOpen(false)
  }, [match, narrow])

  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
      {status === 'ready' ? <Stage narrow={narrow} /> : <OpenLog dragging={dragging} />}
      {status === 'ready' && dragging ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-3 z-30 rounded-[22px] border-2 border-dashed border-foreground/30 bg-background/40"
        />
      ) : null}
    </TooltipProvider>
  )
}
