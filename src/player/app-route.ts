import { CYCLE_HASH } from './deep-link'

/** Where the replay lives. The site root is the landing page. */
export const APP_PATH = '/app'

const APP_PARAMS = ['url', 'live']

/**
 * Whether an address at the root is a link meant for the replay. Links shared before the app
 * moved to {@link APP_PATH} carry `?url=`, `?live=` or `#t=` and must keep opening the match.
 * Anything else, like a section anchor or a tracking parameter, stays on the landing page.
 */
export function forwardsToApp(searchStr: string, hash: string): boolean {
  const params = new URLSearchParams(searchStr)
  return (
    APP_PARAMS.some((name) => params.has(name)) ||
    CYCLE_HASH.test(hash.startsWith('#') ? hash : `#${hash}`)
  )
}
