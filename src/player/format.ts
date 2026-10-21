import { sideOfSlot, unumOfSlot } from '@/analysis/events'
import type { Match, Side } from '@/rcg/types'

const SECONDS_PER_MINUTE = 60
const MS_PER_SECOND = 1000
const PAD = 2
const PERCENT = 100
const METERS_PER_KM = 1000
const KM_FROM = 10_000

/** Server cycle shown at a playhead position. */
export function cycleAt(match: Match, frame: number): number {
  const last = match.frames.count - 1
  return match.frames.cycle[Math.min(Math.max(Math.round(frame), 0), last)] ?? 0
}

/** First frame at or after `cycle`. Cycles never go back, so a binary search finds it. */
export function frameOfCycle(match: Match, cycle: number): number {
  const { cycle: cycles, count } = match.frames
  let low = 0
  let high = count - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if ((cycles[mid] ?? 0) < cycle) low = mid + 1
    else high = mid
  }
  return low
}

/** Match clock as `mm:ss` from a cycle and the cycle length. */
export function clockOf(cycle: number, stepMs: number): string {
  const seconds = Math.floor((cycle * stepMs) / MS_PER_SECOND)
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE)
  const rest = seconds % SECONDS_PER_MINUTE
  return `${String(minutes).padStart(PAD, '0')}:${String(rest).padStart(PAD, '0')}`
}

/** Team name for display, with a fallback when the log has none. */
export function teamName(match: Match, side: Side): string {
  const name = side === 'l' ? match.leftName : match.rightName
  if (name !== '') return name
  return side === 'l' ? 'Esquerda' : 'Direita'
}

/** A player as people say it: team and shirt number. */
export function playerName(match: Match, slot: number): string {
  return `${teamName(match, sideOfSlot(slot))} ${unumOfSlot(slot)}`
}

/** A share 0..1 as a whole percent. */
export function percent(share: number): string {
  return `${Math.round(share * PERCENT)}%`
}

/** A distance in meters, switching to km past 10 km. */
export function distance(meters: number): string {
  if (meters >= KM_FROM) return `${(meters / METERS_PER_KM).toFixed(1).replace('.', ',')} km`
  return `${Math.round(meters).toLocaleString('pt-BR')} m`
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½' }

/** A playback speed as people read it: ¼×, ½×, 1×, 2×. */
export function speedLabel(speed: number): string {
  return `${FRACTIONS[String(speed)] ?? String(speed)}×`
}
