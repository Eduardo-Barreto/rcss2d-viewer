import { Crosshair, Flame, MousePointerClick } from 'lucide-react'
import { useMemo } from 'react'

import { sideOfSlot } from '@/analysis/events'
import type { Tally } from '@/analysis/stats'
import { cn } from '@/lib/utils'
import { distance, playerName } from '@/player/format'
import { staminaSeries } from '@/player/panel-data'
import { useReplay } from '@/player/store'
import { SLOT_COUNT, type SlotFloat } from '@/rcg/types'

import { IslandButton } from '../island'

const SPARK_POINTS = 240
const SPARK_WIDTH = 300
const SPARK_HEIGHT = 48
const DECIMALS = 2
const DOT = { l: 'bg-(--team-l)', r: 'bg-(--team-r)' } as const

function saves(tally: Tally): string {
  if (tally.punches === 0) return String(tally.catches)
  return `${tally.catches} e ${tally.punches} soco${tally.punches > 1 ? 's' : ''}`
}

const FIELDS: readonly { label: string; read: (tally: Tally) => string }[] = [
  { label: 'Gols', read: (tally) => String(tally.goals) },
  { label: 'Chutes', read: (tally) => `${tally.shotsOnTarget}/${tally.shots} no gol` },
  { label: 'Passes certos', read: (tally) => `${tally.passesComplete}/${tally.passes}` },
  { label: 'Toques na bola', read: (tally) => String(tally.touches) },
  { label: 'Desarmes', read: (tally) => `${tally.tackles} (${tally.tacklesMissed} errados)` },
  { label: 'Defesas', read: saves },
  { label: 'Faltas sofridas', read: (tally) => String(tally.fouled) },
  { label: 'Cartões', read: (tally) => `${tally.yellow} amarelo, ${tally.red} vermelho` },
  { label: 'Corrida', read: (tally) => distance(tally.distance) },
]

function useNow(slot: number, field: SlotFloat): number {
  return useReplay((s) => {
    if (s.match === null) return 0
    return s.match.frames.players[field][Math.round(s.frame) * SLOT_COUNT + slot] ?? 0
  })
}

function Stamina({ slot }: { slot: number }) {
  const match = useReplay((s) => s.match)
  const max = useReplay((s) => s.analysis?.physics.staminaMax ?? 1)
  const last = (match?.frames.count ?? 1) - 1
  const stamina = useNow(slot, 'stamina')
  const effort = useNow(slot, 'effort')
  const recovery = useNow(slot, 'recovery')
  const cursor = useReplay((s) => (last <= 0 ? 0 : (s.frame / last) * SPARK_WIDTH))
  const points = useMemo(() => {
    if (match === null) return ''
    const series = staminaSeries(match, slot, SPARK_POINTS)
    return series.frames
      .map((frame, i) => {
        const x = last <= 0 ? 0 : (frame / last) * SPARK_WIDTH
        const y = SPARK_HEIGHT - ((series.values[i] ?? 0) / max) * SPARK_HEIGHT
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [match, slot, last, max])

  return (
    <section aria-label="Fôlego" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-[12px]">
        <h3 className="font-medium text-muted-foreground">Fôlego</h3>
        <span className="font-mono tabular-nums">
          {Math.round(stamina)} <span className="text-muted-foreground">/ {max}</span>
        </span>
      </div>
      <svg
        aria-hidden
        className="h-12 w-full overflow-visible text-foreground"
        preserveAspectRatio="none"
        viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      >
        <polyline
          fill="none"
          points={points}
          stroke="currentColor"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <line
          stroke="currentColor"
          strokeOpacity={0.35}
          vectorEffect="non-scaling-stroke"
          x1={cursor}
          x2={cursor}
          y1={0}
          y2={SPARK_HEIGHT}
        />
      </svg>
      <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
        esforço {effort.toFixed(DECIMALS)} · recuperação {recovery.toFixed(DECIMALS)}
      </p>
    </section>
  )
}

/** The selected player: stamina over the match and their numbers. */
export function PlayerTab() {
  const match = useReplay((s) => s.match)
  const slot = useReplay((s) => s.selected)
  const tally = useReplay((s) => (s.selected < 0 ? undefined : s.analysis?.players[s.selected]))
  const follow = useReplay((s) => s.follow)
  const heatOn = useReplay((s) => s.overlays.heatmap && s.heat === 'selected')
  const setFollow = useReplay((s) => s.setFollow)
  const setHeat = useReplay((s) => s.setHeat)
  const toggleOverlay = useReplay((s) => s.toggleOverlay)
  const type = useReplay((s) =>
    s.match === null || s.selected < 0
      ? -1
      : (s.match.frames.type[Math.round(s.frame) * SLOT_COUNT + s.selected] ?? -1),
  )

  if (match === null || slot < 0 || tally === undefined) {
    return (
      <p className="flex items-center gap-2 px-2 py-6 text-[13px] text-muted-foreground">
        <MousePointerClick aria-hidden className="size-4" />
        Clique num jogador no campo ou na lista de estatísticas.
      </p>
    )
  }
  const following = follow === 'selected'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span aria-hidden className={cn('size-2.5 rounded-full', DOT[sideOfSlot(slot)])} />
        <h3 className="flex-1 text-[15px] font-semibold">{playerName(match, slot)}</h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {type < 0 ? 'fora' : `tipo ${type}`}
        </span>
      </div>
      <div className="flex gap-1.5">
        <IslandButton
          aria-pressed={following}
          className="flex-1 justify-center"
          onClick={() => setFollow(following ? 'off' : 'selected')}
          variant="secondary"
        >
          <Crosshair aria-hidden className="size-4" />
          Seguir
        </IslandButton>
        <IslandButton
          aria-pressed={heatOn}
          className="flex-1 justify-center"
          onClick={() => (heatOn ? toggleOverlay('heatmap') : setHeat('selected'))}
          variant="secondary"
        >
          <Flame aria-hidden className="size-4" />
          Mapa de calor
        </IslandButton>
      </div>
      <Stamina slot={slot} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {FIELDS.map((field) => (
          <div className="contents" key={field.label}>
            <dt className="text-muted-foreground">{field.label}</dt>
            <dd className="text-right font-mono tabular-nums">{field.read(tally)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
