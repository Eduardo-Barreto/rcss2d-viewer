import type { Analysis } from '@/analysis/analyze'
import type { Tally } from '@/analysis/stats'
import { type Match, type ParamMap, SLOT_COUNT, type Side } from '@/rcg/types'

import { distance, percent } from './format'

/** One line of the team comparison: a label and each side's number, already formatted. */
export interface ComparisonRow {
  label: string
  l: number
  r: number
  text: Record<Side, string>
}

function row(
  label: string,
  teams: Record<Side, Tally>,
  read: (tally: Tally) => number,
): ComparisonRow {
  const l = read(teams.l)
  const r = read(teams.r)
  return { label, l, r, text: { l: String(l), r: String(r) } }
}

function withShare(
  label: string,
  teams: Record<Side, Tally>,
  part: (tally: Tally) => number,
  whole: (tally: Tally) => number,
): ComparisonRow {
  const base = row(label, teams, part)
  const text = (side: Side) => `${part(teams[side])}/${whole(teams[side])}`
  return { ...base, text: { l: text('l'), r: text('r') } }
}

/** The team comparison shown at the top of the stats tab. */
export function comparisonRows(analysis: Analysis): ComparisonRow[] {
  const { teams, possession } = analysis
  const ball: ComparisonRow = {
    label: 'Posse',
    l: possession.l,
    r: possession.r,
    text: { l: percent(possession.l), r: percent(possession.r) },
  }
  const run = row('Distância', teams, (tally) => tally.distance)
  return [
    ball,
    row('Chutes', teams, (tally) => tally.shots),
    row('No gol', teams, (tally) => tally.shotsOnTarget),
    withShare(
      'Passes certos',
      teams,
      (tally) => tally.passesComplete,
      (tally) => tally.passes,
    ),
    row('Toques na bola', teams, (tally) => tally.touches),
    withShare(
      'Desarmes',
      teams,
      (tally) => tally.tackles,
      (tally) => tally.tackles + tally.tacklesMissed,
    ),
    row('Defesas do goleiro', teams, (tally) => tally.catches),
    row('Faltas sofridas', teams, (tally) => tally.fouled),
    row('Cartões', teams, (tally) => tally.yellow + tally.red),
    { ...run, text: { l: distance(run.l), r: distance(run.r) } },
  ]
}

/** A per-frame player value, thinned to at most `points` samples for a sparkline. */
export interface Series {
  /** Frame of each sample. */
  frames: number[]
  values: number[]
}

/** Stamina of one slot over the match, skipping frames where the slot is empty. */
export function staminaSeries(match: Match, slot: number, points: number): Series {
  const { count, type, players } = match.frames
  const stride = Math.max(1, Math.ceil(count / points))
  const series: Series = { frames: [], values: [] }
  for (let frame = 0; frame < count; frame += stride) {
    const k = frame * SLOT_COUNT + slot
    if ((type[k] ?? -1) < 0) continue
    series.frames.push(frame)
    series.values.push(players.stamina[k] ?? 0)
  }
  return series
}

/** One parameter for the parameters tab. */
export interface ParamRow {
  name: string
  value: string
}

/** Parameters whose name contains the query, sorted by name. */
export function filterParams(params: ParamMap, query: string): ParamRow[] {
  const needle = query.trim().toLowerCase()
  const rows: ParamRow[] = []
  for (const [name, value] of params) {
    if (needle === '' || name.toLowerCase().includes(needle))
      rows.push({ name, value: String(value) })
  }
  return rows.toSorted((a, b) => a.name.localeCompare(b.name))
}
