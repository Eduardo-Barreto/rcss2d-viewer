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
  /** Closes the connection and keeps what arrived, for {@link LiveConnection.save}. */
  disconnect: () => void
  /** The match so far as a gzipped `.rcg`, null when it cannot be saved. */
  save: () => Promise<Blob | null>
  /** Stops the worker and drops everything it kept. */
  stop: () => void
}

/** The part of a `Worker` a live session uses, so tests can stand in for it. */
interface LiveWorker {
  postMessage: (request: WorkerRequest, transfer: Transferable[]) => void
  terminate: () => void
  addEventListener: ((
    type: 'message',
    listener: (event: MessageEvent<LiveReply>) => void,
  ) => void) &
    ((type: 'error', listener: () => void) => void)
}

function spawnParser(): LiveWorker {
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
}

/**
 * Connects to a relay from the parser worker. The URL must already have passed
 * `checkLiveUrl`. The worker outlives the connection, so the match can still be saved, until
 * {@link LiveConnection.stop}.
 */
export function connectLive(
  url: string,
  handlers: LiveHandlers,
  spawn: () => LiveWorker = spawnParser,
): LiveConnection {
  const worker = spawn()
  const saves: ((file: Blob | null) => void)[] = []
  let dead = false
  const send = (request: WorkerRequest) => {
    if (!dead) worker.postMessage(request, [])
  }
  const kill = () => {
    dead = true
    worker.terminate()
    for (const resolve of saves.splice(0)) resolve(null)
  }
  worker.addEventListener('message', (event: MessageEvent<LiveReply>) => {
    const reply = event.data
    if (reply.kind === 'live-open') handlers.open(reply.server)
    else if (reply.kind === 'live-delta') handlers.delta(reply.delta)
    else if (reply.kind === 'live-end') handlers.end(reply.reason)
    else saves.shift()?.(reply.file)
  })
  worker.addEventListener('error', () => {
    kill()
    handlers.end('closed')
  })
  send({ kind: 'live', url })
  return {
    kickOff: () => send({ kind: 'command', command: '(dispstart)' }),
    disconnect: () => send({ kind: 'stop' }),
    save: () => {
      if (dead) return Promise.resolve(null)
      const { promise, resolve } = Promise.withResolvers<Blob | null>()
      saves.push(resolve)
      send({ kind: 'save' })
      return promise
    },
    stop: kill,
  }
}
