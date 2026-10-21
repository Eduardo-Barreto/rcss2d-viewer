import { PLAY_ON } from '@/rcg/playmodes'
import type { Match, Side } from '@/rcg/types'

import { type MatchEvent, findEvents } from './events'
import { slotsOf } from './field'
import { type Physics, physicsOf } from './params'
import {
  type Goal,
  type Tally,
  creditGoals,
  distanceBySlot,
  sumTallies,
  tallyBySlot,
} from './stats'
import { type Pass, type Shot, ownerByFrame, passesOf, shotsOf, touchesOf } from './touches'

/** Everything derived from a match once, when it loads. */
export interface Analysis {
  physics: Physics
  events: MatchEvent[]
  passes: Pass[]
  shots: Shot[]
  goals: Goal[]
  /** Ball owner per frame: 0 left, 1 right, -1 nobody. */
  owner: Int8Array
  /** Share of `play_on` frames each side owned the ball, 0..1. */
  possession: Record<Side, number>
  players: Tally[]
  teams: Record<Side, Tally>
}

function possessionOf(match: Match, owner: Int8Array): Record<Side, number> {
  let left = 0
  let right = 0
  for (let frame = 0; frame < owner.length; frame++) {
    if (match.frames.playmode[frame] !== PLAY_ON) continue
    if (owner[frame] === 0) left++
    else if (owner[frame] === 1) right++
  }
  const total = left + right
  return total === 0 ? { l: 0, r: 0 } : { l: left / total, r: right / total }
}

/** Runs every analysis over a parsed match. */
export function analyzeMatch(match: Match): Analysis {
  const physics = physicsOf(match)
  const events = findEvents(match)
  const touches = touchesOf(events)
  const shots = shotsOf(match, touches, physics)
  const shotFrames = new Set(shots.map((shot) => `${shot.frame}:${shot.slot}`))
  const passes = passesOf(match, touches).filter(
    (pass) => !shotFrames.has(`${pass.frame}:${pass.from}`),
  )
  const goals = creditGoals(events)
  const owner = ownerByFrame(match, touches)
  const players = tallyBySlot({ events, passes, shots, goals, distance: distanceBySlot(match) })
  return {
    physics,
    events,
    passes,
    shots,
    goals,
    owner,
    possession: possessionOf(match, owner),
    players,
    teams: { l: sumTallies(players, slotsOf('l')), r: sumTallies(players, slotsOf('r')) },
  }
}
