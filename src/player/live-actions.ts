import { analyzeMatch } from '@/analysis/analyze'
import { type LiveConnection, connectLive } from '@/rcg/live'
import { LiveMatch } from '@/rcg/live-match'
import type { LiveEnd } from '@/rcg/protocol'
import { RcgError } from '@/rcg/scanner'
import { checkLiveUrl } from '@/rcg/source'

import { EMPTY, type LiveState, type ReplayState, lastFrame } from './store'

type SetState = (partial: Partial<ReplayState>) => void
type GetState = () => ReplayState

let connection: LiveConnection | null = null
let analysisTimer: ReturnType<typeof setTimeout> | null = null
let analyzedAt = 0

/** Longest the analysis of a live match lags behind its frames. */
const LIVE_ANALYSIS_MS = 1500

const END_TEXT: Record<LiveEnd, string> = {
  closed: 'A ponte fechou a conexão antes do primeiro quadro.',
  unreachable:
    'Não consegui falar com a ponte. Ela está rodando (just relay)? No Safari, ws:// não funciona numa página https.',
  full: 'O jogo passou do limite de quadros.',
  restarted: 'O servidor começou outra partida antes do primeiro quadro.',
  invalid: 'A ponte mandou algo que não é do monitor do rcssserver.',
}

function cancelAnalysis(): void {
  if (analysisTimer !== null) clearTimeout(analysisTimer)
  analysisTimer = null
}

/** Closes the live connection, if any, without touching the state. */
export function leaveLive(): void {
  connection?.stop()
  connection = null
  cancelAnalysis()
}

/**
 * The live half of the replay store. Each batch lands in one {@link LiveMatch}; the playhead
 * follows the newest frame until the viewer moves it, and the analysis, which reads the whole
 * match, runs at most every {@link LIVE_ANALYSIS_MS}.
 */
export function liveActions(
  set: SetState,
  get: GetState,
): Pick<ReplayState, 'connect' | 'disconnect' | 'kickOff' | 'followLive'> {
  const patch = (change: Partial<LiveState>) => {
    const { live } = get()
    if (live !== null) set({ live: { ...live, ...change } })
  }
  const analyze = () => {
    analysisTimer = null
    analyzedAt = Date.now()
    const { match } = get()
    if (match !== null) set({ analysis: analyzeMatch(match) })
  }
  const later = () => {
    if (get().analysis === null || Date.now() - analyzedAt >= LIVE_ANALYSIS_MS) analyze()
    else analysisTimer ??= setTimeout(analyze, LIVE_ANALYSIS_MS)
  }
  const finish = (reason: LiveEnd) => {
    leaveLive()
    if (get().match === null) {
      set({ ...EMPTY, status: 'error', error: END_TEXT[reason] })
      return
    }
    analyze()
    patch({ phase: 'ended', end: reason, following: false })
  }

  return {
    connect(raw, connector = connectLive) {
      get().close()
      let url: string
      try {
        url = checkLiveUrl(raw).href
      } catch (error) {
        if (!(error instanceof RcgError)) throw error
        set({ ...EMPTY, status: 'error', error: error.message })
        return
      }
      const live = new LiveMatch()
      set({
        ...EMPTY,
        status: 'loading',
        name: 'Ao vivo',
        live: { url, phase: 'connecting', server: 'down', end: null, following: true },
      })
      const opened = connector(url, {
        open: (server) => patch({ phase: 'open', server }),
        delta(delta) {
          const match = live.apply(delta)
          if (match === null) return
          const { live: state, frame } = get()
          const following = state?.following ?? false
          set({ status: 'ready', match, frame: following ? lastFrame(match) : frame })
          later()
        },
        end: finish,
      })
      const phase = get().live?.phase
      if (phase === 'connecting' || phase === 'open') connection = opened
    },

    disconnect() {
      if (connection === null) return
      if (get().match !== null) {
        finish('closed')
        return
      }
      leaveLive()
      set(EMPTY)
    },

    kickOff() {
      connection?.kickOff()
    },

    followLive() {
      const { live, match } = get()
      if (live === null || live.phase === 'ended') return
      set({ live: { ...live, following: true }, frame: lastFrame(match), playing: false })
    },
  }
}
