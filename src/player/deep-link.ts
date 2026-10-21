/** What a shared address asks for: a log to open and a cycle to start at. */
export interface DeepLink {
  url: string | null
  cycle: number | null
}

const CYCLE = /^#t=(?<cycle>\d{1,6})$/

/** Reads `?url=<https log>` and `#t=<cycle>` from the address. */
export function parseDeepLink(search: string, hash: string): DeepLink {
  const url = new URLSearchParams(search).get('url')
  const cycle = CYCLE.exec(hash)?.groups?.cycle
  return {
    url: url === null || url === '' ? null : url,
    cycle: cycle === undefined ? null : Number(cycle),
  }
}

/** The fragment that points at a cycle. */
export function cycleHash(cycle: number): string {
  return `#t=${Math.max(0, Math.round(cycle))}`
}
