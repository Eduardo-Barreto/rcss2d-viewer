import { PLAYMODES } from './playmodes'

const SHOW_EXTRAS = /^\(show (?<cycle>\d+) \(pm (?<mode>\d+)\) \(tm (?<team>[^()]*)\) /

interface ShowExtras {
  cycle: string
  mode: string
  team: string
  /** The show without its `(pm)` and `(tm)`. */
  show: string
}

function splitShow(line: string): ShowExtras | null {
  const found = SHOW_EXTRAS.exec(line)
  const { cycle, mode, team } = found?.groups ?? {}
  if (found === null || cycle === undefined || mode === undefined || team === undefined) {
    return null
  }
  return { cycle, mode: PLAYMODES[Number(mode)] ?? '', team, show: line.slice(found[0].length) }
}

/**
 * Turns the lines a monitor received back into a version 6 `.rcg`, the format the server's
 * own logger writes (`src/logger.cpp:166-170`): the play mode and the score leave the show,
 * where `DispSenderMonitorV3::sendShow` puts them (`src/dispsender.cpp:443-501`), and become
 * `(playmode)` and `(team)` lines written when they change.
 */
export function monitorLinesToRcg(lines: readonly string[]): string {
  const out = ['ULG6']
  let mode = ''
  let team = ''
  for (const line of lines) {
    const extras = splitShow(line)
    if (extras === null) {
      out.push(line)
      continue
    }
    if (extras.mode !== mode && extras.mode !== '') {
      out.push(`(playmode ${extras.cycle} ${extras.mode})`)
    }
    if (extras.team !== team) out.push(`(team ${extras.cycle} ${extras.team})`)
    mode = extras.mode
    team = extras.team
    out.push(`(show ${extras.cycle} ${extras.show}`)
  }
  return `${out.join('\n')}\n`
}
