import { RcgError } from './scanner'

/** Largest file the viewer accepts, before decompression. */
export const MAX_INPUT_BYTES = 268_435_456

/** Where a log comes from: a local file or an `https` URL. */
export type LogSource = { kind: 'file'; file: Blob; name: string } | { kind: 'url'; url: string }

/**
 * Checks a remote log address. Only `https` is allowed, so a link can never point the viewer at
 * `file:`, `data:`, `javascript:` or a plain-text intranet address.
 */
export function checkLogUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new RcgError('Endereço inválido.')
  }
  if (url.protocol !== 'https:') throw new RcgError('Só aceito endereços https.')
  if (url.username !== '' || url.password !== '') {
    throw new RcgError('O endereço não pode ter usuário e senha.')
  }
  return url
}

/** Display name for a source: the file name, or the last path segment of the URL. */
export function sourceName(source: LogSource): string {
  if (source.kind === 'file') return source.name
  const path = new URL(source.url).pathname
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1)) || source.url
}

/** Opens a source as a byte stream plus its size when known. */
export async function openSource(
  source: LogSource,
  signal?: AbortSignal,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null }> {
  if (source.kind === 'file') {
    if (source.file.size > MAX_INPUT_BYTES) throw new RcgError('O arquivo passa de 256 MB.')
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
  const size = Number(response.headers.get('content-length'))
  if (size > MAX_INPUT_BYTES) throw new RcgError('O arquivo passa de 256 MB.')
  return { stream: response.body, size: Number.isFinite(size) && size > 0 ? size : null }
}
