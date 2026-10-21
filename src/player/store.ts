import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { type Analysis, analyzeMatch } from '@/analysis/analyze'
import type { LiveConnection, LiveHandlers } from '@/rcg/live'
import { loadMatch } from '@/rcg/load'
import type { LiveEnd } from '@/rcg/protocol'
import { RcgError } from '@/rcg/scanner'
import { type LogSource, sourceName } from '@/rcg/source'
import type { Match } from '@/rcg/types'
import type { Overlays } from '@/render/scene'

import { leaveLive, liveActions } from './live-actions'

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

/** A live session: where it comes from and how it is going. */
export interface LiveState {
  url: string
  phase: 'connecting' | 'open' | 'ended'
  server: 'up' | 'down'
  end: LiveEnd | null
  /** The playhead sticks to the newest frame. */
  following: boolean
}

/** Opens a live session; the real one runs in the parser worker, tests pass a fake. */
type LiveConnector = (url: string, handlers: LiveHandlers) => LiveConnection

/** The replay: the loaded match, the playhead and every view choice. */
export interface ReplayState {
  status: LoadStatus
  progress: { loaded: number; total: number | null }
  error: string | null
  name: string
  /** Remote address of the open log, `null` for a local file. */
  url: string | null
  match: Match | null
  analysis: Analysis | null
  /** The live session, `null` for a log read from a file or URL. */
  live: LiveState | null
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
  show: (match: Match, name: string, url?: string | null) => void
  close: () => void
  /** Connects to a relay, once the address passes `checkLiveUrl`. */
  connect: (url: string, connector?: LiveConnector) => void
  /** Leaves the live session and keeps the frames that arrived. */
  disconnect: () => void
  /** The live match so far as a gzipped `.rcg`, null when it cannot be saved. */
  saveLive: () => Promise<Blob | null>
  /** Asks the server to start the match. */
  kickOff: () => void
  /** Jumps to the newest frame and sticks to it. */
  followLive: () => void
  /** Drops a failed read's message, back to the empty open screen. */
  clearError: () => void
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
/** State of a viewer with nothing open. */
export const EMPTY = {
  status: 'empty' as LoadStatus,
  progress: { loaded: 0, total: null },
  error: null,
  name: '',
  url: null,
  match: null,
  analysis: null,
  live: null,
  frame: 0,
  playing: false,
  selected: -1,
}

let pending: AbortController | null = null
/** Index of the newest frame, 0 with no match. */
export function lastFrame(match: Match | null): number {
  return match === null ? 0 : match.frames.count - 1
}

function isLive(live: LiveState | null): boolean {
  return live !== null && live.phase !== 'ended'
}

/** The live state with the playhead stuck to the newest frame or not; nothing changes once over. */
function following(live: LiveState | null, stick: boolean): LiveState | null {
  if (live === null || !isLive(live) || live.following === stick) return live
  return { ...live, following: stick }
}

function clampFrame(match: Match | null, frame: number): number {
  if (!Number.isFinite(frame)) return 0
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
          if (pending === controller) {
            get().show(match, sourceName(source), source.kind === 'url' ? source.url : null)
          }
        } catch (error) {
          if (controller.signal.aborted) return
          set({ status: 'error', error: errorText(error) })
        } finally {
          if (pending === controller) pending = null
        }
      },

      show(match, name, url = null) {
        set({ ...EMPTY, status: 'ready', name, url, match, analysis: analyzeMatch(match) })
      },

      clearError() {
        if (get().status === 'error') set({ status: 'empty', error: null })
      },

      close() {
        pending?.abort()
        pending = null
        leaveLive()
        set(EMPTY)
      },

      ...liveActions(set, get),

      seek(frame) {
        const { match, live } = get()
        const at = clampFrame(match, frame)
        set({ frame: at, live: following(live, at >= lastFrame(match)) })
      },

      step(frames) {
        const { match, frame, live } = get()
        const at = clampFrame(match, Math.round(frame) + frames)
        set({ playing: false, frame: at, live: following(live, at >= lastFrame(match)) })
      },

      advance(ms) {
        const { match, analysis, frame, speed, playing, live } = get()
        if (!playing || match === null || analysis === null) return
        const next = clampFrame(match, frame + (ms / analysis.physics.stepMs) * speed)
        const last = lastFrame(match)
        if (next < last) set({ frame: next })
        else set({ frame: last, playing: false, live: following(live, true) })
      },

      togglePlay() {
        const { match, frame, playing, live } = get()
        if (match === null) return
        const atEnd = frame >= lastFrame(match)
        if (atEnd && isLive(live)) return
        set({
          playing: !playing,
          frame: !playing && atEnd ? 0 : frame,
          live: following(live, false),
        })
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
