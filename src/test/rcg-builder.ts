import { COUNTERS, type Counter, type Side } from '@/rcg/types'

/** One player in a {@link showLine}. */
export interface PlayerSpec {
  side: Side
  unum: number
  x: number
  y: number
  vx?: number
  vy?: number
  type?: number
  state?: number
  stamina?: number
  counts?: Partial<Record<Counter, number>>
}

const HEX = 16
const FULL_STAMINA = 8000

/** Ball position and velocity. */
export type BallSpec = [x: number, y: number, vx: number, vy: number]

function playerText(spec: PlayerSpec): string {
  const counts = COUNTERS.map((name) => spec.counts?.[name] ?? 0)
  const state = `0x${(spec.state ?? 1).toString(HEX)}`
  return [
    `((${spec.side} ${spec.unum}) ${spec.type ?? 0} ${state}`,
    `${spec.x} ${spec.y} ${spec.vx ?? 0} ${spec.vy ?? 0} 0 0`,
    `(v h 90) (s ${spec.stamina ?? FULL_STAMINA} 1 1 130600) (c ${counts.join(' ')}))`,
  ].join(' ')
}

/** A `(show ...)` line as rcssserver 19 writes it. */
export function showLine(cycle: number, ball: BallSpec, players: PlayerSpec[]): string {
  return `(show ${cycle} ((b) ${ball.join(' ')}) ${players.map(playerText).join(' ')})`
}

/** A whole v6 log from its lines. */
export function rcgText(...lines: string[]): string {
  return ['ULG6', ...lines].join('\n')
}
