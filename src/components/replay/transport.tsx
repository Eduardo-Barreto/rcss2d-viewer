import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
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
import { clockOf, cycleAt, speedLabel } from '@/player/format'
import { type Moment, momentJump } from '@/player/moments'
import { SPEEDS, useReplay } from '@/player/store'

import { Hint, Island, IslandButton, IslandSeparator } from './island'
import { Timeline } from './timeline'

function jump(moments: Moment[], direction: 1 | -1): void {
  const { frame, seek } = useReplay.getState()
  const target = momentJump(moments, frame, direction)
  if (target !== null) seek(target)
}

function Clock() {
  const match = useReplay((s) => s.match)
  const stepMs = useReplay((s) => s.analysis?.physics.stepMs ?? 0)
  const cycle = useReplay((s) => (s.match === null ? 0 : cycleAt(s.match, s.frame)))
  if (match === null) return null
  const end = cycleAt(match, match.frames.count - 1)
  return (
    <p className="px-1.5 font-mono text-[12px] whitespace-nowrap text-muted-foreground tabular-nums @max-md:hidden">
      <span className="text-foreground">{clockOf(cycle, stepMs)}</span> / {clockOf(end, stepMs)}
    </p>
  )
}

function SpeedMenu() {
  const speed = useReplay((s) => s.speed)
  const setSpeed = useReplay((s) => s.setSpeed)
  return (
    <DropdownMenu>
      <Hint label="Velocidade" shortcut="[ ]">
        <DropdownMenuTrigger asChild>
          <IslandButton
            aria-label={`Velocidade: ${speedLabel(speed)}`}
            className="min-w-12 font-mono tabular-nums"
          >
            {speedLabel(speed)}
          </IslandButton>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="center" side="top" sideOffset={8}>
        <DropdownMenuLabel>Velocidade</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) => setSpeed(Number(value))}
          value={String(speed)}
        >
          {SPEEDS.map((value) => (
            <DropdownMenuRadioItem
              className="font-mono tabular-nums"
              key={value}
              value={String(value)}
            >
              {speedLabel(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Props of {@link Transport}. */
export interface TransportProps {
  moments: Moment[]
  className?: string
  /** Extra buttons at the end of the controls. */
  children?: ReactNode
}

/** Playback controls over the timeline. */
export function Transport({ moments, className, children }: TransportProps) {
  const playing = useReplay((s) => s.playing)
  const togglePlay = useReplay((s) => s.togglePlay)
  const step = useReplay((s) => s.step)

  return (
    <Island className={cn('@container flex-col items-stretch gap-1 px-3 pt-2 pb-1', className)}>
      <Timeline moments={moments} />
      <div className="flex items-center gap-0.5">
        <Hint label="Lance anterior" shortcut="Shift E">
          <IslandButton aria-label="Lance anterior" onClick={() => jump(moments, -1)}>
            <SkipBack aria-hidden className="size-4" />
          </IslandButton>
        </Hint>
        <Hint label="Quadro anterior" shortcut="←">
          <IslandButton aria-label="Quadro anterior" onClick={() => step(-1)}>
            <ChevronLeft aria-hidden className="size-4" />
          </IslandButton>
        </Hint>
        <Hint label={playing ? 'Pausar' : 'Reproduzir'} shortcut="Espaço">
          <IslandButton
            aria-label={playing ? 'Pausar' : 'Reproduzir'}
            className="min-w-11"
            onClick={togglePlay}
            variant="default"
          >
            {playing ? (
              <Pause aria-hidden className="size-4" />
            ) : (
              <Play aria-hidden className="size-4" />
            )}
          </IslandButton>
        </Hint>
        <Hint label="Próximo quadro" shortcut="→">
          <IslandButton aria-label="Próximo quadro" onClick={() => step(1)}>
            <ChevronRight aria-hidden className="size-4" />
          </IslandButton>
        </Hint>
        <Hint label="Próximo lance" shortcut="E">
          <IslandButton aria-label="Próximo lance" onClick={() => jump(moments, 1)}>
            <SkipForward aria-hidden className="size-4" />
          </IslandButton>
        </Hint>
        <IslandSeparator />
        <SpeedMenu />
        <span className="flex-1" />
        <Clock />
        {children}
      </div>
    </Island>
  )
}
