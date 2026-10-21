import { playModeId } from '../rcg/playmodes.ts'

const SHOW_HEAD = /^\(show (?<cycle>\d+)/

/**
 * Rewrites a v6 `.rcg` as a monitor connection would have received it: no header, no
 * `(playmode)` or `(team)` lines, and `(pm N) (tm ...)` at the start of every show, the way
 * `DispSenderMonitorV3::sendShow` writes them (rcssserver `src/dispsender.cpp:470-476`).
 */
export function asMonitorLines(text: string): string[] {
  let mode = 0
  let team = 'null null 0 0'
  const lines: string[] = []
  for (const line of text.split('\n').slice(1)) {
    const words = line.slice(1, -1).split(' ')
    if (line.startsWith('(playmode ')) mode = playModeId(words[2] ?? '') ?? mode
    else if (line.startsWith('(team ')) team = words.slice(2).join(' ')
    else if (line.startsWith('(show ')) {
      lines.push(line.replace(SHOW_HEAD, (head) => `${head} (pm ${mode}) (tm ${team})`))
    } else if (line !== '') lines.push(line)
  }
  return lines
}
