import { type CSSProperties, useMemo } from 'react'

import { cn } from '@/lib/utils'
import { clockOf, cycleAt, teamName } from '@/player/format'
import { useReplay } from '@/player/store'
import { playModeLabel, playModeSide } from '@/rcg/playmodes'
import type { Match, Side } from '@/rcg/types'

import { ISLAND } from './island'
import { TeamLogo } from './team-logo'

function scoreAt(match: Match, frame: number) {
  const i = Math.min(Math.max(Math.round(frame), 0), match.frames.count - 1)
  const score = match.scores.findLast((change) => change.frame <= i)
  return {
    left: match.frames.scoreLeft[i] ?? 0,
    right: match.frames.scoreRight[i] ?? 0,
    penalties:
      score !== undefined &&
      score.penaltiesLeft +
        score.penaltiesRight +
        score.penaltyMissesLeft +
        score.penaltyMissesRight >
        0
        ? { left: score.penaltiesLeft, right: score.penaltiesRight }
        : null,
  }
}

function Team({ match, side }: { match: Match; side: Side }) {
  const name = teamName(match, side)
  return (
    <div
      className={cn('flex min-w-0 flex-1 items-center gap-2', side === 'r' && 'flex-row-reverse')}
    >
      <span
        aria-hidden
        className={cn('size-2.5 flex-none rounded-full', side === 'l' ? 'bg-team-l' : 'bg-team-r')}
      />
      <TeamLogo
        className="h-6 w-auto flex-none rounded-[4px] phone:hidden"
        tiles={match.graphics[side]}
      />
      <span
        className={cn('truncate text-[13px] font-medium', side === 'r' && 'text-right')}
        title={name}
      >
        {name}
      </span>
    </div>
  )
}

/** Props of {@link Scoreboard}. */
export interface ScoreboardProps {
  className?: string
  style?: CSSProperties
}

/** Teams, score, clock and play mode at the playhead. */
export function Scoreboard({ className, style }: ScoreboardProps) {
  const match = useReplay((s) => s.match)
  const stepMs = useReplay((s) => s.analysis?.physics.stepMs ?? 0)
  const cycle = useReplay((s) => (s.match === null ? 0 : cycleAt(s.match, s.frame)))
  const frame = useReplay((s) => Math.round(s.frame))
  const mode = match?.frames.playmode[frame] ?? 0
  const score = useMemo(() => (match === null ? null : scoreAt(match, frame)), [match, frame])
  if (match === null || score === null) return null
  const side = playModeSide(mode)

  return (
    <section
      aria-label="Placar da partida"
      className={cn(ISLAND, 'flex-col gap-0 px-3 py-1.5', className)}
      style={style}
    >
      <div className="flex w-full items-center gap-3">
        <Team match={match} side="l" />
        <p className="flex-none font-mono text-[22px] leading-7 font-semibold tabular-nums">
          <span className="sr-only">Placar </span>
          {score.left}
          <span aria-hidden className="px-1 text-muted-foreground">
            :
          </span>
          <span className="sr-only"> a </span>
          {score.right}
          {score.penalties === null ? null : (
            <span className="ml-1.5 text-[12px] font-medium text-muted-foreground">
              <span className="sr-only"> nos pênaltis </span>({score.penalties.left}:
              {score.penalties.right})
            </span>
          )}
        </p>
        <Team match={match} side="r" />
      </div>
      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="font-mono tabular-nums">{clockOf(cycle, stepMs)}</span>
        <span aria-hidden>·</span>
        <span className="font-mono tabular-nums">ciclo {cycle}</span>
        <span aria-hidden>·</span>
        <span className="flex items-center gap-1">
          {side === null ? null : (
            <span
              aria-hidden
              className={cn('size-1.5 rounded-full', side === 'l' ? 'bg-team-l' : 'bg-team-r')}
            />
          )}
          {playModeLabel(mode)}
          {side === null ? '' : <span className="sr-only">: {teamName(match, side)}</span>}
        </span>
      </p>
    </section>
  )
}
