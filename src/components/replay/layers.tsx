import {
  BatteryMedium,
  ChevronDown,
  Eye,
  Flag,
  Flame,
  FolderOpen,
  type LucideIcon,
  Spline,
} from 'lucide-react'
import type { ReactNode } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { teamName } from '@/player/format'
import { type HeatSubject, useReplay } from '@/player/store'
import type { Overlays } from '@/render/scene'

import { Hint, Island, IslandButton, IslandSeparator } from './island'
import { MoreMenu } from './more-menu'

interface Layer {
  key: keyof Overlays
  label: string
  shortcut: string
  icon: LucideIcon
}

const LAYERS_BEFORE_HEAT: readonly Layer[] = [
  { key: 'trails', label: 'Rastros', shortcut: 'T', icon: Spline },
  { key: 'cones', label: 'Campo de visão', shortcut: 'V', icon: Eye },
  { key: 'offside', label: 'Linha de impedimento', shortcut: 'O', icon: Flag },
]
const STAMINA: Layer = { key: 'stamina', label: 'Fôlego', shortcut: 'S', icon: BatteryMedium }

const HEAT_SUBJECTS: readonly HeatSubject[] = ['ball', 'l', 'r', 'selected']

function LayerToggle({ layer }: { layer: Layer }) {
  const on = useReplay((s) => s.overlays[layer.key])
  const toggle = useReplay((s) => s.toggleOverlay)
  const Icon = layer.icon
  return (
    <Hint label={layer.label} shortcut={layer.shortcut} side="bottom">
      <IslandButton aria-label={layer.label} aria-pressed={on} onClick={() => toggle(layer.key)}>
        <Icon aria-hidden className="size-4" />
      </IslandButton>
    </Hint>
  )
}

function useHeatLabel(): (subject: HeatSubject) => string {
  const match = useReplay((s) => s.match)
  return (subject) => {
    if (subject === 'ball') return 'Bola'
    if (subject === 'selected') return 'Jogador escolhido'
    return match === null ? subject : teamName(match, subject)
  }
}

function HeatToggle() {
  const on = useReplay((s) => s.overlays.heatmap)
  const heat = useReplay((s) => s.heat)
  const toggle = useReplay((s) => s.toggleOverlay)
  const setHeat = useReplay((s) => s.setHeat)
  const label = useHeatLabel()
  return (
    <div className={cn('flex rounded-[10px]', on && 'bg-foreground text-background')}>
      <Hint label={`Mapa de calor: ${label(heat)}`} shortcut="H" side="bottom">
        <IslandButton
          aria-label="Mapa de calor"
          aria-pressed={on}
          className="rounded-r-none hover:bg-current/10 aria-pressed:bg-transparent dark:hover:bg-current/10 aria-pressed:hover:bg-current/10 dark:aria-pressed:hover:bg-current/10"
          onClick={() => toggle('heatmap')}
        >
          <Flame aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IslandButton
            aria-label="De quem é o mapa de calor"
            className={cn(
              'min-w-6 rounded-l-none px-1 hover:bg-current/10 aria-expanded:bg-current/10 has-[>svg]:px-1 dark:hover:bg-current/10 phone:min-w-7',
              on && 'text-background hover:text-background aria-expanded:text-background',
            )}
          >
            <ChevronDown aria-hidden className="size-3.5" />
          </IslandButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuLabel>Mapa de calor de</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(value) => {
              const subject = HEAT_SUBJECTS.find((each) => each === value)
              if (subject !== undefined) setHeat(subject)
            }}
            value={heat}
          >
            {HEAT_SUBJECTS.map((subject) => (
              <DropdownMenuRadioItem key={subject} value={subject}>
                {label(subject)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** Props of {@link Layers}. */
export interface LayersProps {
  onHelp: () => void
  /** Puts "Seguir a bola" in the overflow menu, for screens without the zoom island. */
  follow?: boolean
  className?: string
  /** Extra buttons at the end of the island. */
  children?: ReactNode
}

/** What the pitch draws, an overflow menu and opening another log. */
export function Layers({ onHelp, follow = false, className, children }: LayersProps) {
  const close = useReplay((s) => s.close)

  return (
    <Island className={className}>
      {LAYERS_BEFORE_HEAT.map((layer) => (
        <LayerToggle key={layer.key} layer={layer} />
      ))}
      <HeatToggle />
      <LayerToggle layer={STAMINA} />
      <IslandSeparator />
      <MoreMenu follow={follow} onHelp={onHelp} />
      <IslandSeparator />
      <Hint label="Abrir outra partida" side="bottom">
        <IslandButton aria-label="Abrir outra partida" onClick={close}>
          <FolderOpen aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
      {children}
    </Island>
  )
}
