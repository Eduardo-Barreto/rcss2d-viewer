/** Where the replay lives. The site root is the landing page. */
export const APP_PATH = '/app'

/**
 * Whether an address at the root is a link meant for the replay. Links shared before the app
 * moved to {@link APP_PATH} carry `?url=`, `?live=` or `#t=` and must keep opening the match.
 */
export function forwardsToApp(searchStr: string, hash: string): boolean {
  const search = searchStr.startsWith('?') ? searchStr.slice(1) : searchStr
  return search !== '' || hash.replace(/^#/, '') !== ''
}
