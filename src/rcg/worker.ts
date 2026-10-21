import { frameBuffers } from './columns'
import { LiveSession } from './live-session'
import type { LiveReply, LoadReply, WorkerRequest } from './protocol'
import { RcgError } from './scanner'
import { type LogSource, openSource } from './source'
import { readRcgStream } from './stream'

const PROGRESS_STEP = 262_144

function reply(message: LoadReply | LiveReply, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer })
}

async function load(source: LogSource): Promise<void> {
  try {
    const { stream, size } = await openSource(source)
    let reported = 0
    const match = await readRcgStream(stream, (loaded) => {
      if (loaded - reported < PROGRESS_STEP) return
      reported = loaded
      reply({ kind: 'progress', loaded, total: size })
    })
    reply({ kind: 'done', match }, frameBuffers(match.frames))
  } catch (error) {
    const message = error instanceof RcgError ? error.message : 'Erro inesperado ao ler o log.'
    reply({ kind: 'error', message })
  }
}

let live: LiveSession | null = null

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.kind === 'load') void load(request.source)
  else if (request.kind === 'live') live = new LiveSession(request.url, reply)
  else if (request.kind === 'command') live?.command(request.command)
  else live?.stop()
})
