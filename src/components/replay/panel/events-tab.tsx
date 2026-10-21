import { Check } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { clockOf } from '@/player/format'
import { type Moment, type MomentKind, MOMENT_LEAD_FRAMES } from '@/player/moments'
import { useReplay } from '@/player/store'

const KINDS: readonly { kind: MomentKind; label: string }[] = [
  { kind: 'goal', label: 'Gols' },
  { kind: 'shot', label: 'Chutes' },
  { kind: 'foul', label: 'Faltas' },
  { kind: 'card', label: 'Cartões' },
  { kind: 'setPiece', label: 'Bola parada' },
]
const DEFAULT_KINDS: MomentKind[] = ['goal', 'shot', 'foul', 'card']
const ALL_KINDS: MomentKind[] = KINDS.map(({ kind }) => kind)
const DOT = { l: 'bg-(--team-l)', r: 'bg-(--team-r)' } as const

function isKind(value: string): value is MomentKind {
  return KINDS.some((each) => each.kind === value)
}

function Row({ moment }: { moment: Moment }) {
  const stepMs = useReplay((s) => s.analysis?.physics.stepMs ?? 0)
  const seek = useReplay((s) => s.seek)
  return (
    <li>
      <button
        className={cn(
          'focus-ring-inset flex min-h-8 w-full items-center gap-2 rounded-[8px] px-2 py-1 text-left text-[13px] transition-colors duration-100 hover:bg-accent phone:min-h-10',
          moment.strong && 'font-medium',
        )}
        onClick={() => seek(Math.max(0, moment.frame - MOMENT_LEAD_FRAMES))}
        type="button"
      >
        <span className="w-11 flex-none font-mono text-[12px] text-muted-foreground tabular-nums">
          {clockOf(moment.cycle, stepMs)}
        </span>
        <span
          aria-hidden
          className={cn(
            'size-2 flex-none rounded-full bg-muted-foreground/40',
            moment.side !== null && DOT[moment.side],
          )}
        />
        <span className="min-w-0 flex-1 truncate">{moment.text}</span>
      </button>
    </li>
  )
}

/** Every moment of the match, filtered by kind. Clicking one seeks just before it. */
export function EventsTab({ moments }: { moments: Moment[] }) {
  const [kinds, setKinds] = useState<MomentKind[]>(DEFAULT_KINDS)
  const shown = useMemo(
    () => moments.filter((moment) => kinds.includes(moment.kind)),
    [moments, kinds],
  )
  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup.Root
        aria-label="Tipos de lance"
        className="flex flex-wrap gap-1"
        onValueChange={(values) => setKinds(values.filter(isKind))}
        type="multiple"
        value={kinds}
      >
        {KINDS.map(({ kind, label }) => (
          <ToggleGroup.Item
            className="group focus-ring flex h-7 items-center gap-1 rounded-full border border-foreground/25 px-2.5 text-[12px] text-muted-foreground transition-colors duration-100 hover:text-foreground data-[state=on]:border-transparent data-[state=on]:bg-foreground data-[state=on]:pl-2 data-[state=on]:text-background phone:h-10 phone:px-3.5 phone:data-[state=on]:pl-3"
            key={kind}
            value={kind}
          >
            <Check aria-hidden className="hidden size-3.5 group-data-[state=on]:block" />
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      {moments.length === 0 ? (
        <p className="px-2 text-[13px] text-muted-foreground">Este log não tem lances.</p>
      ) : null}
      {moments.length > 0 && shown.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-2">
          <p className="text-[13px] text-muted-foreground">Nenhum lance desse tipo.</p>
          <Button onClick={() => setKinds(ALL_KINDS)} size="sm" variant="outline">
            Mostrar todos
          </Button>
        </div>
      ) : null}
      {shown.length === 0 ? null : (
        <ul className="flex flex-col">
          {shown.map((moment) => (
            <Row key={`${moment.frame}-${moment.kind}-${moment.slot}`} moment={moment} />
          ))}
        </ul>
      )}
    </div>
  )
}
