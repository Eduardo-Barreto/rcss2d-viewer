/** What a shared address asks for: a log to open or a relay to watch, and a cycle to start at. */
export interface DeepLink {
  url: string | null
  live: string | null
  cycle: number | null
}

/** Where the open match comes from, as far as the address cares. */
export interface LinkSource {
  url: string | null
  live: string | null
}

/** A `#t=<cycle>` fragment, the cycle at most six digits. */
export const CYCLE_HASH = /^#t=(?<cycle>\d{1,6})$/

function param(params: URLSearchParams, name: string): string | null {
  const value = params.get(name)
  return value === null || value === '' ? null : value
}

/** Reads `?url=<https log>`, `?live=<relay>` and `#t=<cycle>` from the address. */
export function parseDeepLink(search: string, hash: string): DeepLink {
  const params = new URLSearchParams(search)
  const cycle = CYCLE_HASH.exec(hash)?.groups?.cycle
  return {
    url: param(params, 'url'),
    live: param(params, 'live'),
    cycle: cycle === undefined ? null : Number(cycle),
  }
}

/** The fragment that points at a cycle. */
export function cycleHash(cycle: number): string {
  return `#t=${Math.max(0, Math.round(cycle))}`
}

/**
 * The address for an open log: `?url=` only when it came from the network, so a local file
 * never leaves a stale link behind, or `?live=` for a relay, plus the cycle when there is one.
 */
export function addressOf(pathname: string, source: LinkSource, cycle: number | null): string {
  const params = new URLSearchParams()
  if (source.live !== null) params.set('live', source.live)
  else if (source.url !== null) params.set('url', source.url)
  const search = params.size === 0 ? '' : `?${params.toString()}`
  return `${pathname}${search}${cycle === null ? '' : cycleHash(cycle)}`
}
