import type { Analysis } from '@/analysis/analyze'
import type { EventKind } from '@/analysis/events'
import { playModeLabel } from '@/rcg/playmodes'
import type { Match, Side } from '@/rcg/types'

import { playerName, teamName } from './format'

/** Kinds of moment the timeline and the event list show. */
export type MomentKind = 'goal' | 'shot' | 'foul' | 'card' | 'setPiece'

/** A moment worth jumping to, with its text ready to show. */
export interface Moment {
  frame: number
  cycle: number
  kind: MomentKind
  side: Side | null
  /** Player involved, -1 for none. */
  slot: number
  text: string
  /** Red card, shot on target: the stronger variant of the kind. */
  strong: boolean
}

const CARD_KINDS = new Set<EventKind>(['yellow', 'red'])

function goalMoments(match: Match, analysis: Analysis): Moment[] {
  return analysis.goals.map((goal) => {
    const team = teamName(match, goal.side)
    let text = `Gol: ${team}`
    if (goal.scorer >= 0) {
      text = goal.ownGoal
        ? `Gol contra de ${playerName(match, goal.scorer)}`
        : `Gol de ${playerName(match, goal.scorer)}`
    }
    const cycle = match.frames.cycle[goal.frame] ?? 0
    return {
      frame: goal.frame,
      cycle,
      kind: 'goal',
      side: goal.side,
      slot: goal.scorer,
      text,
      strong: true,
    }
  })
}

function shotMoments(match: Match, analysis: Analysis): Moment[] {
  return analysis.shots.map((shot) => ({
    frame: shot.frame,
    cycle: match.frames.cycle[shot.frame] ?? 0,
    kind: 'shot',
    side: shot.side,
    slot: shot.slot,
    text: `${shot.onTarget ? 'Chute no gol' : 'Chute para fora'}: ${playerName(match, shot.slot)}`,
    strong: shot.onTarget,
  }))
}

function refereeMoments(match: Match, analysis: Analysis): Moment[] {
  const out: Moment[] = []
  for (const event of analysis.events) {
    const base = { frame: event.frame, cycle: event.cycle, side: event.side, slot: event.slot }
    if (event.kind === 'fouled') {
      out.push({
        ...base,
        kind: 'foul',
        text: `Falta sofrida por ${playerName(match, event.slot)}`,
        strong: false,
      })
    } else if (CARD_KINDS.has(event.kind)) {
      const red = event.kind === 'red'
      const card = red ? 'Vermelho' : 'Amarelo'
      out.push({
        ...base,
        kind: 'card',
        text: `${card} para ${playerName(match, event.slot)}`,
        strong: red,
      })
    } else if (event.kind === 'playmode') {
      const who = event.side === null ? '' : `: ${teamName(match, event.side)}`
      out.push({
        ...base,
        kind: 'setPiece',
        text: `${playModeLabel(event.mode)}${who}`,
        strong: false,
      })
    }
  }
  return out
}

/** Goals, shots, fouls, cards and set pieces, in frame order. */
export function momentsOf(match: Match, analysis: Analysis): Moment[] {
  return [
    ...goalMoments(match, analysis),
    ...shotMoments(match, analysis),
    ...refereeMoments(match, analysis),
  ].toSorted((a, b) => a.frame - b.frame)
}

/** The next moment after `frame` (or before, with a negative `direction`) of the given kinds. */
export function nextMoment(
  moments: Moment[],
  frame: number,
  direction: 1 | -1,
  kinds?: ReadonlySet<MomentKind>,
): Moment | undefined {
  const wanted = (moment: Moment) => kinds === undefined || kinds.has(moment.kind)
  const here = Math.round(frame)
  if (direction > 0) return moments.find((moment) => moment.frame > here && wanted(moment))
  return moments.findLast((moment) => moment.frame < here && wanted(moment))
}

/** Frames shown before a moment when jumping to it, so the play leading to it is visible. */
export const MOMENT_LEAD_FRAMES = 30

/**
 * Where to seek to land a little before the next or previous moment, or null when there is none.
 * Moments are compared by where they land, so jumping twice in a row walks the moments instead of
 * landing on the same one again, and a moment closer than the lead is still reachable.
 */
export function momentJump(
  moments: Moment[],
  frame: number,
  direction: 1 | -1,
  kinds?: ReadonlySet<MomentKind>,
): number | null {
  const here = Math.round(frame)
  const landing = (moment: Moment) => Math.max(0, moment.frame - MOMENT_LEAD_FRAMES)
  const wanted = (moment: Moment) => kinds === undefined || kinds.has(moment.kind)
  const moment =
    direction > 0
      ? moments.find((each) => landing(each) > here && wanted(each))
      : moments.findLast((each) => landing(each) < here && wanted(each))
  return moment === undefined ? null : landing(moment)
}
