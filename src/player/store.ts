import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { type Analysis, analyzeMatch } from '@/analysis/analyze'
import { loadMatch } from '@/rcg/load'
import { RcgError } from '@/rcg/scanner'
import { type LogSource, sourceName } from '@/rcg/source'
import type { Match } from '@/rcg/types'
import type { Overlays } from '@/render/scene'

const SLOWEST_DOUBLING = -2
const FASTEST_DOUBLING = 4

/** Playback speeds offered, as multiples of real time: ¼× to 16×, doubling each step. */
export const SPEEDS: readonly number[] = Array.from(
  { length: FASTEST_DOUBLING - SLOWEST_DOUBLING + 1 },
  (_, i) => 2 ** (i + SLOWEST_DOUBLING),
)

/** What the heatmap counts. */
export type HeatSubject = 'ball' | 'l' | 'r' | 'selected'

/** What the camera keeps in the middle. */
type Follow = 'off' | 'ball' | 'selected'

/** Tabs of the side panel. */
export type PanelTab = 'stats' | 'events' | 'player' | 'messages' | 'params'

/** Where the log is in its life. */
type LoadStatus = 'empty' | 'loading' | 'ready' | 'error'

/** The replay: the loaded match, the playhead and every view choice. */
export interface ReplayState {
  status: LoadStatus
  progress: { loaded: number; total: number | null }
  error: string | null
  name: string
  match: Match | null
  analysis: Analysis | null
  /** Playhead, a frame index that may fall between two frames. */
  frame: number
  playing: boolean
  speed: number
  /** Selected slot, -1 for none. */
  selected: number
  follow: Follow
  overlays: Overlays
  heat: HeatSubject
  panelOpen: boolean
  tab: PanelTab
  open: (source: LogSource) => Promise<void>
  show: (match: Match, name: string) => void
  close: () => void
  seek: (frame: number) => void
  step: (frames: number) => void
  advance: (ms: number) => void
  togglePlay: () => void
  setSpeed: (speed: number) => void
  shiftSpeed: (steps: number) => void
  select: (slot: number) => void
  setFollow: (follow: Follow) => void
  toggleOverlay: (key: keyof Overlays) => void
  setHeat: (heat: HeatSubject) => void
  setPanelOpen: (open: boolean) => void
  setTab: (tab: PanelTab) => void
}

const DEFAULT_OVERLAYS: Overlays = {
  trails: true,
  cones: false,
  offside: false,
  heatmap: false,
  stamina: false,
}

const NORMAL_SPEED = 1
const EMPTY = {
  status: 'empty' as LoadStatus,
  progress: { loaded: 0, total: null },
  error: null,
  name: '',
  match: null,
  analysis: null,
  frame: 0,
  playing: false,
  selected: -1,
}

let pending: AbortController | null = null

function lastFrame(match: Match | null): number {
  return match === null ? 0 : match.frames.count - 1
}

function clampFrame(match: Match | null, frame: number): number {
  return Math.min(Math.max(frame, 0), lastFrame(match))
}

function errorText(error: unknown): string {
  if (error instanceof RcgError) return error.message
  return 'Não consegui ler esse arquivo.'
}

/** The replay store. View choices survive a reload; the match never leaves memory. */
export const useReplay = create<ReplayState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      speed: NORMAL_SPEED,
      follow: 'off',
      overlays: DEFAULT_OVERLAYS,
      heat: 'ball',
      panelOpen: true,
      tab: 'stats',

      async open(source) {
        pending?.abort()
        const controller = new AbortController()
        pending = controller
        set({ ...EMPTY, status: 'loading', name: sourceName(source) })
        try {
          const match = await loadMatch(
            source,
            (loaded, total) => set({ progress: { loaded, total } }),
            controller.signal,
          )
          if (pending === controller) get().show(match, sourceName(source))
        } catch (error) {
          if (controller.signal.aborted) return
          set({ status: 'error', error: errorText(error) })
        } finally {
          if (pending === controller) pending = null
        }
      },

      show(match, name) {
        set({ ...EMPTY, status: 'ready', name, match, analysis: analyzeMatch(match) })
      },

      close() {
        pending?.abort()
        pending = null
        set(EMPTY)
      },

      seek(frame) {
        set({ frame: clampFrame(get().match, frame) })
      },

      step(frames) {
        const { match, frame } = get()
        set({ playing: false, frame: clampFrame(match, Math.round(frame) + frames) })
      },

      advance(ms) {
        const { match, analysis, frame, speed, playing } = get()
        if (!playing || match === null || analysis === null) return
        const next = frame + (ms / analysis.physics.stepMs) * speed
        const last = lastFrame(match)
        set(next >= last ? { frame: last, playing: false } : { frame: next })
      },

      togglePlay() {
        const { match, frame, playing } = get()
        if (match === null) return
        const atEnd = frame >= lastFrame(match)
        set({ playing: !playing, frame: !playing && atEnd ? 0 : frame })
      },

      setSpeed(speed) {
        set({ speed })
      },

      shiftSpeed(steps) {
        const index = SPEEDS.findIndex((speed) => speed >= get().speed)
        const at = Math.min(Math.max(index + steps, 0), SPEEDS.length - 1)
        set({ speed: SPEEDS[at] ?? NORMAL_SPEED })
      },

      select(slot) {
        const { follow, tab } = get()
        set({
          selected: slot,
          follow: slot < 0 && follow === 'selected' ? 'off' : follow,
          tab: slot >= 0 && tab === 'stats' ? 'player' : tab,
        })
      },

      setFollow(follow) {
        set({ follow })
      },

      toggleOverlay(key) {
        const { overlays } = get()
        set({ overlays: { ...overlays, [key]: !overlays[key] } })
      },

      setHeat(heat) {
        set({ heat, overlays: { ...get().overlays, heatmap: true } })
      },

      setPanelOpen(panelOpen) {
        set({ panelOpen })
      },

      setTab(tab) {
        set({ tab, panelOpen: true })
      },
    }),
    {
      name: 'rcss2d-viewer:view',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ speed, overlays, heat, panelOpen }) => ({ speed, overlays, heat, panelOpen }),
    },
  ),
)
