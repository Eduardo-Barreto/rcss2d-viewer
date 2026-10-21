import type { LoadReply, LoadRequest } from './protocol'
import { RcgError } from './scanner'
import type { LogSource } from './source'
import type { Match } from './types'

/** Progress callback: bytes read and the total when known. */
export type LoadProgress = (loaded: number, total: number | null) => void

/**
 * Parses a log in a dedicated worker so a large file never freezes the page. Aborting
 * terminates the worker, which is the only reliable way to stop a parse half way.
 */
export function loadMatch(
  source: LogSource,
  onProgress: LoadProgress,
  signal?: AbortSignal,
): Promise<Match> {
  const { promise, resolve, reject } = Promise.withResolvers<Match>()
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  const stop = () => {
    worker.terminate()
    reject(new DOMException('Leitura cancelada.', 'AbortError'))
  }
  signal?.addEventListener('abort', stop, { once: true })
  worker.addEventListener('message', (event: MessageEvent<LoadReply>) => {
    const reply = event.data
    if (reply.kind === 'progress') {
      onProgress(reply.loaded, reply.total)
      return
    }
    signal?.removeEventListener('abort', stop)
    worker.terminate()
    if (reply.kind === 'done') resolve(reply.match)
    else reject(new RcgError(reply.message))
  })
  worker.addEventListener('error', () => {
    worker.terminate()
    reject(new RcgError('O leitor de logs parou de responder.'))
  })
  const request: LoadRequest = { source }
  worker.postMessage(request, [])
  return promise
}
