import {
  BatteryMedium,
  ChevronDown,
  CircleHelp,
  Eye,
  Flag,
  Flame,
  FolderOpen,
  ImageDown,
  type LucideIcon,
  Moon,
  Spline,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
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

const REVOKE_AFTER_MS = 1000
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
              'min-w-6 rounded-l-none px-1 hover:bg-current/10 aria-expanded:bg-current/10 has-[>svg]:px-1 dark:hover:bg-current/10 max-[720px]:min-w-7',
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

function exportImage(name: string, cycle: number): void {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-pitch]')
  canvas?.toBlob((blob) => {
    if (blob === null) return
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name.replace(/\.rcg(?:\.gz)?$/i, '')}-ciclo-${cycle}.png`
    link.click()
    setTimeout(() => URL.revokeObjectURL(link.href), REVOKE_AFTER_MS)
  }, 'image/png')
}

function cycleNow(): number {
  const { match, frame } = useReplay.getState()
  return match?.frames.cycle[Math.round(frame)] ?? 0
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const label = dark ? 'Tema claro' : 'Tema escuro'
  return (
    <Hint label={label} side="bottom">
      <IslandButton
        aria-label={label}
        className="max-[720px]:hidden"
        onClick={() => setTheme(dark ? 'light' : 'dark')}
      >
        {dark ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
      </IslandButton>
    </Hint>
  )
}

/** Props of {@link Layers}. */
export interface LayersProps {
  onHelp: () => void
  className?: string
  /** Extra buttons at the end of the island. */
  children?: ReactNode
}

/** What the pitch draws, plus theme, image export, help and opening another log. */
export function Layers({ onHelp, className, children }: LayersProps) {
  const name = useReplay((s) => s.name)
  const close = useReplay((s) => s.close)

  return (
    <Island className={className}>
      {LAYERS_BEFORE_HEAT.map((layer) => (
        <LayerToggle key={layer.key} layer={layer} />
      ))}
      <HeatToggle />
      <LayerToggle layer={STAMINA} />
      <IslandSeparator />
      <Hint label="Salvar imagem" side="bottom">
        <IslandButton
          aria-label="Salvar imagem do campo"
          className="max-[720px]:hidden"
          onClick={() => exportImage(name, cycleNow())}
        >
          <ImageDown aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
      <ThemeToggle />
      <Hint label="Atalhos" shortcut="?" side="bottom">
        <IslandButton aria-label="Atalhos" className="max-[720px]:hidden" onClick={onHelp}>
          <CircleHelp aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
      <Hint label="Abrir outra partida" side="bottom">
        <IslandButton aria-label="Abrir outra partida" onClick={close}>
          <FolderOpen aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
      {children}
    </Island>
  )
}
