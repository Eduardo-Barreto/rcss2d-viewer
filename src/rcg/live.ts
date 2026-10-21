import type { MatchDelta } from './parser'
import type { LiveEnd, LiveReply, WorkerRequest } from './protocol'

/** What the page hears from a live session. */
export interface LiveHandlers {
  open: (server: 'up' | 'down') => void
  delta: (delta: MatchDelta) => void
  end: (reason: LiveEnd) => void
}

/** A live session running in the parser worker. */
export interface LiveConnection {
  /** Asks the server to start the match; the relay only passes it on before the kick-off. */
  kickOff: () => void
  /** Leaves the session and stops the worker. */
  stop: () => void
}

/**
 * Connects to a relay from the parser worker. The URL must already have passed
 * `checkLiveUrl`. Each reply lands in one of the handlers, and the worker goes away when the
 * session ends.
 */
export function connectLive(url: string, handlers: LiveHandlers): LiveConnection {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  const send = (request: WorkerRequest) => {
    worker.postMessage(request, [])
  }
  worker.addEventListener('message', (event: MessageEvent<LiveReply>) => {
    const reply = event.data
    if (reply.kind === 'live-open') handlers.open(reply.server)
    else if (reply.kind === 'live-delta') handlers.delta(reply.delta)
    else {
      worker.terminate()
      handlers.end(reply.reason)
    }
  })
  worker.addEventListener('error', () => {
    worker.terminate()
    handlers.end('closed')
  })
  send({ kind: 'live', url })
  return {
    kickOff: () => send({ kind: 'command', command: '(dispstart)' }),
    stop: () => {
      send({ kind: 'stop' })
      worker.terminate()
    },
  }
}
