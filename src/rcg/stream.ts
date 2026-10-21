import { DEFAULT_LIMITS, RcgParser, type RcgLimits } from './parser'
import { RcgError } from './scanner'
import type { Match } from './types'

const GZIP_ID1 = 0x1f
const GZIP_ID2 = 0x8b
const NEWLINE = '\n'
const FIRST_BINARY_VERSION = 2
const LAST_BINARY_VERSION = 3
const VERSION_BYTE = 3
const HEADER_PROBE = 4
const ULG = 'ULG'
const OPEN_BRACKET = 0x5b
const OPEN_BRACE = 0x7b

/** Progress of a read, in bytes of the original (possibly compressed) input. */
export type ProgressCallback = (bytesRead: number) => void

function isGzip(head: Uint8Array): boolean {
  return head[0] === GZIP_ID1 && head[1] === GZIP_ID2
}

/** Refuses the formats that are not text `.rcg`, with a message that says which one it is. */
function checkTextLog(head: Uint8Array): void {
  const ulg = new TextDecoder().decode(head.subarray(0, ULG.length)) === ULG
  const version = head[VERSION_BYTE] ?? 0
  if (ulg && version >= FIRST_BINARY_VERSION && version <= LAST_BINARY_VERSION) {
    throw new RcgError(
      `Este é um .rcg binário (versão ${version}), de servidores antigos. Converta para a versão 4 ou mais nova.`,
    )
  }
  if (head[0] === OPEN_BRACKET || head[0] === OPEN_BRACE) {
    throw new RcgError('O .rcg em JSON ainda não é suportado. Grave o log em texto (versão 4 a 6).')
  }
}

function counting(
  onProgress: ProgressCallback | undefined,
): TransformStream<Uint8Array, Uint8Array> {
  let read = 0
  return new TransformStream({
    transform(chunk, controller) {
      read += chunk.byteLength
      onProgress?.(read)
      controller.enqueue(chunk)
    },
  })
}

/** Errors the stream once more than `max` bytes went through it, so a gzip bomb stops early. */
function capped(max: number): TransformStream<Uint8Array, Uint8Array> {
  let total = 0
  return new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength
      if (total > max) {
        controller.error(new RcgError('O log descomprimido passa do limite de tamanho.'))
        return
      }
      controller.enqueue(chunk)
    },
  })
}

async function readHead(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const first = await reader.read()
  const head = first.done ? new Uint8Array() : first.value
  const rest = new ReadableStream<Uint8Array>({
    start(controller) {
      if (head.byteLength > 0) controller.enqueue(head)
    },
    async pull(controller) {
      const next = await reader.read()
      if (next.done) controller.close()
      else controller.enqueue(next.value)
    },
    cancel: (reason) => reader.cancel(reason),
  })
  return { head, stream: rest }
}

function decompressed(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the DOM types say BufferSource in; the stream only ever sees Uint8Array chunks
  const gunzip = new DecompressionStream('gzip') as TransformStream<Uint8Array, Uint8Array>
  return stream.pipeThrough(gunzip)
}

async function feedLines(stream: ReadableStream<Uint8Array>, parser: RcgParser, limits: RcgLimits) {
  const decoder = new TextDecoder('utf-8')
  let carry = ''
  let checked = false
  const reader = stream.getReader()
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    const chunk = next.value
    if (!checked) {
      checkTextLog(chunk.subarray(0, HEADER_PROBE))
      checked = true
    }
    const text = carry + decoder.decode(chunk, { stream: true })
    const lines = text.split(NEWLINE)
    carry = lines.pop() ?? ''
    if (carry.length > limits.maxLineLength) {
      throw new RcgError('Uma linha do log passa do limite de tamanho.')
    }
    for (const line of lines) parser.push(line)
  }
  parser.pushLast(carry + decoder.decode())
}

/**
 * Reads a `.rcg` or `.rcg.gz` from a byte stream. Gzip is detected by its magic bytes, not by
 * the file name, and decompressed with the browser's `DecompressionStream`.
 */
export async function readRcgStream(
  source: ReadableStream<Uint8Array>,
  onProgress?: ProgressCallback,
  limits: RcgLimits = DEFAULT_LIMITS,
): Promise<Match> {
  const { head, stream } = await readHead(source.pipeThrough(counting(onProgress)))
  const plain = isGzip(head) ? decompressed(stream) : stream
  const parser = new RcgParser(limits)
  try {
    await feedLines(plain.pipeThrough(capped(limits.maxBytes)), parser, limits)
  } catch (error) {
    if (error instanceof RcgError) throw error
    throw new RcgError('Não consegui ler o arquivo. O gzip pode estar corrompido.', {
      cause: error,
    })
  }
  return parser.finish()
}
