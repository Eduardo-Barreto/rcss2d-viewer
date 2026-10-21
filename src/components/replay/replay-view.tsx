import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { addressOf, cycleHash, parseDeepLink } from '@/player/deep-link'
import { cycleAt, frameOfCycle, teamName } from '@/player/format'
import { momentsOf } from '@/player/moments'
import { useReplay } from '@/player/store'

import { HelpDialog } from './help-dialog'
import { Layers } from './layers'
import { LiveNotice } from './live-controls'
import { OpenLog } from './open-log'
import { Panel, PanelToggle, SHEET_SHARE } from './panel/panel'
import { type Insets, PitchView } from './pitch-view'
import { Scoreboard } from './scoreboard'
import { Transport } from './transport'
import { useCompact, useNarrow, useViewportHeight } from './use-narrow'
import { usePlayback } from './use-playback'
import { useShortcuts } from './use-shortcuts'
import { Zoom } from './zoom'

const PANEL_WIDTH = 340
const EDGE = 12
const TOP_INSET = 64
const TOP_INSET_COMPACT = 136
const PERCENT = 100
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

/**
 * `?url=` opens a log on arrival and `#t=` seeks once that first log is read. Every log opened
 * after it rewrites the whole address, and pausing writes `#t=` back.
 */
function useDeepLink(): void {
  const hasMatch = useReplay((s) => s.match !== null)
  const match = useReplay((s) => s.match)
  const url = useReplay((s) => s.url)
  const live = useReplay((s) => s.live?.url ?? null)
  const playing = useReplay((s) => s.playing)
  const arrival = useRef(parseDeepLink(window.location.search, window.location.hash))
  const shown = useRef(false)

  useEffect(() => {
    const first = arrival.current
    if (useReplay.getState().status !== 'empty') return
    if (first.live !== null) useReplay.getState().connect(first.live)
    else if (first.url !== null) void useReplay.getState().open({ kind: 'url', url: first.url })
  }, [])

  // Keyed on whether a match is open, not on the match: a live one changes ten times a second.
  useEffect(() => {
    const { pathname } = window.location
    const current = useReplay.getState().match
    if (current === null) {
      if (shown.current) window.history.replaceState(null, '', pathname)
      shown.current = false
      return
    }
    shown.current = true
    const { cycle } = arrival.current
    arrival.current = { url: null, live: null, cycle: null }
    if (cycle !== null && live === null) useReplay.getState().seek(frameOfCycle(current, cycle))
    window.history.replaceState(null, '', addressOf(pathname, { url, live }, cycle))
  }, [hasMatch, url, live])

  const wasPlaying = useRef(false)
  useEffect(() => {
    const paused = wasPlaying.current && !playing
    wasPlaying.current = playing
    if (match === null || !paused) return
    const hash = cycleHash(cycleAt(match, useReplay.getState().frame))
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
  }, [match, playing])
}

interface Layout {
  insets: Insets
  /** Where the top islands end on the right, clear of the side panel. */
  right: CSSProperties
  /** The bottom row: clear of the side panel, and above the sheet when it is open. */
  row: CSSProperties
}

const TITLE = 'rcssviewer'

/** Names the tab after the match, so a few open replays can be told apart. */
function useTitle(): void {
  const match = useReplay((s) => s.match)
  useEffect(() => {
    if (match !== null)
      document.title = `${teamName(match, 'l')} × ${teamName(match, 'r')} · ${TITLE}`
    return () => {
      document.title = TITLE
    }
  }, [match])
}

function useLayout(): Layout {
  const panelOpen = useReplay((s) => s.panelOpen)
  const narrow = useNarrow()
  const compact = useCompact()
  const height = useViewportHeight()
  const side = !narrow && panelOpen ? PANEL_WIDTH + EDGE * 2 : EDGE
  const sheet = narrow && panelOpen ? Math.round(height * SHEET_SHARE) : 0
  const top = compact ? TOP_INSET_COMPACT : TOP_INSET
  return useMemo(
    () => ({
      insets: { top, right: side, bottom: BOTTOM_INSET + sheet, left: EDGE },
      right: { right: side },
      row:
        sheet > 0
          ? { right: side, bottom: `calc(${SHEET_SHARE * PERCENT}svh + ${EDGE}px)` }
          : { right: side },
    }),
    [top, side, sheet],
  )
}

function Stage() {
  const match = useReplay((s) => s.match)
  const analysis = useReplay((s) => s.analysis)
  const name = useReplay((s) => s.name)
  const narrow = useNarrow()
  const compact = useCompact()
  const [help, setHelp] = useState(false)
  const toggleHelp = useCallback(() => setHelp((open) => !open), [])
  const moments = useMemo(
    () => (match === null || analysis === null ? [] : momentsOf(match, analysis)),
    [match, analysis],
  )
  const layout = useLayout()

  usePlayback()
  useShortcuts(moments, toggleHelp)
  useTitle()

  return (
    <main className="fixed inset-0 overflow-hidden bg-(--pitch)">
      <h1 className="sr-only">Replay: {name}</h1>
      <PitchView insets={layout.insets} />
      <Scoreboard
        className="fixed top-safe-3 left-safe-3 compact:mx-auto compact:max-w-[560px]"
        style={compact ? layout.right : undefined}
      />
      <div
        className="fixed top-safe-3 flex justify-end compact:top-safe-[76px] compact:left-safe-3 compact:justify-center"
        style={layout.right}
      >
        <Layers className="max-w-full overflow-x-auto" follow={compact} onHelp={toggleHelp}>
          {narrow ? null : <PanelToggle />}
        </Layers>
      </div>
      <div
        className="fixed bottom-safe-3 left-safe-3 flex items-end gap-2 motion-safe:transition-[bottom] motion-safe:duration-240 motion-safe:ease-(--ease-drawer)"
        style={layout.row}
      >
        <LiveNotice className="absolute bottom-full left-0 mb-2 max-w-full" />
        <Transport className="min-w-0 flex-1" moments={moments}>
          {narrow ? <PanelToggle /> : null}
        </Transport>
        <Zoom className="compact:hidden" />
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
      {status === 'ready' ? <Stage /> : <OpenLog dragging={dragging} />}
      {status === 'ready' && dragging ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-3 z-30 grid place-items-center rounded-[22px] border-2 border-dashed border-foreground/40 bg-background/60"
        >
          <p className="rounded-[10px] bg-card px-3 py-2 text-[13px] font-medium shadow-island">
            Solte para abrir outra partida
          </p>
        </div>
      ) : null}
    </TooltipProvider>
  )
}
