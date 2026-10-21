import { frameBuffers } from './columns'
import type { LoadReply, LoadRequest } from './protocol'
import { RcgError } from './scanner'
import { openSource } from './source'
import { readRcgStream } from './stream'

const PROGRESS_STEP = 262_144

function reply(message: LoadReply, transfer: Transferable[] = []): void {
  self.postMessage(message, { transfer })
}

async function load({ source }: LoadRequest): Promise<void> {
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

self.addEventListener('message', (event: MessageEvent<LoadRequest>) => {
  void load(event.data)
})
