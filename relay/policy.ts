/**
 * What the relay lets through: which pages may connect and which commands reach the server.
 * Kept apart from the sockets so every rule has a plain unit test.
 */

const VIEWER_ORIGIN = 'https://rcssviewer.tapout.gg'
/**
 * The viewer's previous host. It now answers with a 301 to `VIEWER_ORIGIN`, so no page should
 * connect from it. Kept so a relay started from an older checkout and a page still served by the
 * old host keep working while the move settles. Remove after 2027-01-31 (ADR 0006).
 */
const LEGACY_VIEWER_ORIGIN = 'https://rcssviewer.barreto.sh'
const PAGES_PROJECT = 'rcss2d-viewer.pages.dev'
const PREVIEW_LABEL = /^[a-z0-9-]{1,63}$/
const DEV_HOSTS = new Set(['localhost', '127.0.0.1', 'rcss2d-viewer.localhost'])
const LOOPBACK_V4 = /^127(?:\.\d{1,3}){3}$/

/** Commands a page may send. Matched whole, so `(dispstart)x` or `(dispbye) ` is dropped. */
export const ALLOWED_COMMANDS: ReadonlySet<string> = new Set(['(dispstart)', '(dispbye)'])

/** True for an address that only this machine can reach. */
export function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '::1' || host === '[::1]' || LOOPBACK_V4.test(host)
}

function isPreview(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port !== '') return false
  if (url.hostname === PAGES_PROJECT) return true
  const suffix = `.${PAGES_PROJECT}`
  if (!url.hostname.endsWith(suffix)) return false
  return PREVIEW_LABEL.test(url.hostname.slice(0, -suffix.length))
}

/**
 * Checks the `Origin` of a WebSocket handshake. Allowed: the viewer, its Pages previews and a
 * dev server on this machine. A browser always sends `Origin` on a WebSocket handshake, so a
 * missing one means a non-browser client, let in only with `allowMissing`.
 */
export function isAllowedOrigin(origin: string | null, allowMissing = false): boolean {
  if (origin === null) return allowMissing
  if (origin === VIEWER_ORIGIN || origin === LEGACY_VIEWER_ORIGIN) return true
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }
  if (url.origin !== origin) return false
  if (isPreview(url)) return true
  return url.protocol === 'http:' && DEV_HOSTS.has(url.hostname)
}

/** Why a command from a page was not passed on, or null when it may go. */
export type CommandRefusal = 'not-allowed' | 'not-waiting' | 'rate'

/** Token bucket: `burst` commands at once, then one every `refillMs`. */
export class RateLimit {
  private tokens: number
  private last: number

  private readonly burst: number
  private readonly refillMs: number

  constructor(burst: number, refillMs: number, now: number) {
    this.burst = burst
    this.refillMs = refillMs
    this.tokens = burst
    this.last = now
  }

  /** Spends one token if there is one. */
  take(now: number): boolean {
    this.tokens = Math.min(this.burst, this.tokens + (now - this.last) / this.refillMs)
    this.last = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}

/**
 * Decides whether a page's command reaches the server. `(dispstart)` kicks off whatever half
 * is due (`Stadium::kickOff`, rcssserver `src/stadium.cpp:1049`), so it only goes while the
 * server waits for the kick-off, and never twice in a row from a page past its rate.
 */
export function checkCommand(
  text: string,
  waiting: boolean,
  limit: RateLimit,
  now: number,
): CommandRefusal | null {
  if (!ALLOWED_COMMANDS.has(text)) return 'not-allowed'
  if (!limit.take(now)) return 'rate'
  if (text === '(dispstart)' && !waiting) return 'not-waiting'
  return null
}
