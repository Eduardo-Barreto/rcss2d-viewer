import { useMemo } from 'react'

import { unumOfSlot } from '@/analysis/events'
import { slotsOf } from '@/analysis/field'
import { cn } from '@/lib/utils'
import { distance, teamName } from '@/player/format'
import { comparisonRows } from '@/player/panel-data'
import { useReplay } from '@/player/store'
import type { Side } from '@/rcg/types'

const EVEN = 0.5
const PERCENT = 100
const SIDES: readonly Side[] = ['l', 'r']
const DOT: Record<Side, string> = { l: 'bg-(--team-l)', r: 'bg-(--team-r)' }

function Bar({ l, r }: { l: number; r: number }) {
  const total = l + r
  const share = total === 0 ? EVEN : l / total
  const width = useMemo(() => ({ width: `${share * PERCENT}%` }), [share])
  return (
    <div
      aria-hidden
      className={cn(
        'flex h-1 overflow-hidden rounded-full',
        total === 0 ? 'bg-muted' : 'bg-(--team-r)/80',
      )}
    >
      {total === 0 ? null : <span className="h-full bg-(--team-l)" style={width} />}
    </div>
  )
}

function Comparison() {
  const analysis = useReplay((s) => s.analysis)
  const rows = useMemo(() => (analysis === null ? [] : comparisonRows(analysis)), [analysis])
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li className="flex flex-col gap-1" key={row.label}>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="font-mono tabular-nums">{row.text.l}</span>
            <span className="text-[12px] text-muted-foreground">{row.label}</span>
            <span className="font-mono tabular-nums">{row.text.r}</span>
          </div>
          <Bar l={row.l} r={row.r} />
        </li>
      ))}
    </ul>
  )
}

function Roster({ side }: { side: Side }) {
  const match = useReplay((s) => s.match)
  const players = useReplay((s) => s.analysis?.players)
  const selected = useReplay((s) => s.selected)
  const select = useReplay((s) => s.select)
  if (match === null || players === undefined) return null
  return (
    <section className="flex flex-col gap-1" aria-label={teamName(match, side)}>
      <h3 className="flex items-center gap-2 px-2 text-[12px] font-medium text-muted-foreground">
        <span aria-hidden className={cn('size-2 rounded-full', DOT[side])} />
        {teamName(match, side)}
        <span className="ml-auto font-mono text-[11px]">toques · corrida</span>
      </h3>
      <ul className="flex flex-col">
        {slotsOf(side).map((slot) => {
          const tally = players[slot]
          if (tally === undefined) return null
          return (
            <li key={slot}>
              <button
                aria-pressed={selected === slot}
                className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] transition-colors duration-100 hover:bg-accent aria-pressed:bg-accent"
                onClick={() => select(selected === slot ? -1 : slot)}
                type="button"
              >
                <span className="w-5 font-mono tabular-nums">{unumOfSlot(slot)}</span>
                <span className="flex-1 truncate text-muted-foreground">
                  {tally.goals > 0 ? `${tally.goals} gol${tally.goals > 1 ? 's' : ''}` : ''}
                </span>
                <span className="font-mono text-[12px] tabular-nums">{tally.kicks}</span>
                <span className="w-16 text-right font-mono text-[12px] text-muted-foreground tabular-nums">
                  {distance(tally.distance)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Team comparison and both rosters. Clicking a player selects them. */
export function StatsTab() {
  return (
    <div className="flex flex-col gap-5">
      <Comparison />
      {SIDES.map((side) => (
        <Roster key={side} side={side} />
      ))}
    </div>
  )
}
