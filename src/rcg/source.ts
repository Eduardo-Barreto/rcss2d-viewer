import { RcgError } from './scanner'

/** Largest file the viewer accepts, before decompression. */
const MAX_INPUT_BYTES = 268_435_456

/** Where a log comes from: a local file or an `https` URL. */
export type LogSource = { kind: 'file'; file: Blob; name: string } | { kind: 'url'; url: string }

/** Origin of the page or worker running, or null outside a browser. */
function ownOrigin(): string | null {
  if (!('location' in globalThis)) return null
  const { origin } = globalThis.location
  return origin === 'null' ? null : origin
}

/**
 * Checks a log address. Another origin must be `https`, so a link can never point the viewer at
 * `file:`, `data:`, `javascript:` or a plain-text intranet address. The viewer's own origin is
 * also accepted over `http`, which only a local dev or preview server serves; a relative path
 * resolves against it.
 * @param origin the viewer's origin, read from the running page by default
 */
export function checkLogUrl(raw: string, origin: string | null = ownOrigin()): URL {
  let url: URL
  try {
    url = new URL(raw, origin ?? undefined)
  } catch {
    throw new RcgError('Endereço inválido.')
  }
  const own = origin !== null && url.origin === origin
  if (url.protocol !== 'https:' && !own) throw new RcgError('Só aceito endereços https.')
  if (url.username !== '' || url.password !== '') {
    throw new RcgError('O endereço não pode ter usuário e senha.')
  }
  return url
}

/** The loopback hosts the CSP lets a page reach over plain `ws`; CSP has no IPv6 literal. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost'])

/**
 * Checks a relay address for the live mode. `wss` goes anywhere; plain `ws` only to this
 * machine, which browsers treat as a secure context and let an https page reach. No user and
 * password, and no fragment, which a WebSocket URL may not have.
 */
export function checkLiveUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new RcgError('Endereço inválido.')
  }
  const local = url.protocol === 'ws:' && LOOPBACK_HOSTS.has(url.hostname)
  if (url.protocol !== 'wss:' && !local) {
    throw new RcgError('Só aceito wss://, ou ws:// em 127.0.0.1 ou localhost.')
  }
  if (url.username !== '' || url.password !== '') {
    throw new RcgError('O endereço não pode ter usuário e senha.')
  }
  if (url.hash !== '') throw new RcgError('O endereço não pode ter #.')
  return url
}

const MAX_NAME_LENGTH = 200
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu

function rawName(source: LogSource): string {
  if (source.kind === 'file') return source.name
  try {
    const path = new URL(source.url).pathname
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)) || source.url
  } catch {
    return source.url
  }
}

/**
 * Display name for a source: the file name, or the last path segment of the URL. Control and
 * format characters go, so a bidi override in a link cannot make `gpj.rcg` read as `rcg.jpg`.
 */
export function sourceName(source: LogSource): string {
  return rawName(source).replace(INVISIBLE, '').slice(0, MAX_NAME_LENGTH)
}

function tooLarge(): RcgError {
  return new RcgError('O arquivo passa de 256 MB.')
}

/** Errors the body once more than `max` bytes arrived, for servers that send no length. */
function cappedBody(max: number): TransformStream<Uint8Array, Uint8Array> {
  let total = 0
  return new TransformStream({
    transform(chunk, controller) {
      total += chunk.byteLength
      if (total > max) controller.error(tooLarge())
      else controller.enqueue(chunk)
    },
  })
}

/**
 * Size of the body the stream will deliver, when the headers say. With `content-encoding` the
 * length is of the encoded bytes while the stream yields decoded ones, so it is unknown.
 */
function bodySize(headers: Headers): number | null {
  const encoding = headers.get('content-encoding')
  if (encoding !== null && encoding.trim().toLowerCase() !== 'identity') return null
  const size = Number(headers.get('content-length') ?? Number.NaN)
  return Number.isFinite(size) && size > 0 ? size : null
}

/**
 * Opens a source as a byte stream plus its size when known. Past `maxBytes` (256 MB) the read
 * fails, checked up front when the size is known and while reading when it is not.
 */
export async function openSource(
  source: LogSource,
  signal?: AbortSignal,
  maxBytes = MAX_INPUT_BYTES,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null }> {
  if (source.kind === 'file') {
    if (source.file.size > maxBytes) throw tooLarge()
    return { stream: source.file.stream(), size: source.file.size }
  }
  const url = checkLogUrl(source.url)
  let response: Response
  try {
    response = await fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    throw new RcgError('Não consegui baixar o log. O servidor pode não permitir CORS.', {
      cause: error,
    })
  }
  if (!response.ok || response.body === null) {
    throw new RcgError(`O servidor respondeu ${response.status} ao baixar o log.`)
  }
  const size = bodySize(response.headers)
  if (size !== null && size > maxBytes) throw tooLarge()
  return { stream: response.body.pipeThrough(cappedBody(maxBytes)), size }
}
