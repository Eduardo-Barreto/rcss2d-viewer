import { PanelRight } from 'lucide-react'
import { Tabs } from 'radix-ui'
import { useMemo } from 'react'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Moment } from '@/player/moments'
import { type PanelTab, useReplay } from '@/player/store'

import { Hint, IslandButton } from '../island'
import { useNarrow } from '../use-narrow'
import { EventsTab } from './events-tab'
import { MessagesTab } from './messages-tab'
import { ParamsTab } from './params-tab'
import { PlayerTab } from './player-tab'
import { StatsTab } from './stats-tab'

const TABS: readonly { tab: PanelTab; label: string }[] = [
  { tab: 'stats', label: 'Números' },
  { tab: 'events', label: 'Lances' },
  { tab: 'player', label: 'Jogador' },
  { tab: 'messages', label: 'Mensagens' },
  { tab: 'params', label: 'Servidor' },
]

function isTab(value: string): value is PanelTab {
  return TABS.some((each) => each.tab === value)
}

function PanelTabs({ moments }: { moments: Moment[] }) {
  const tab = useReplay((s) => s.tab)
  const setTab = useReplay((s) => s.setTab)
  return (
    <Tabs.Root
      className="flex min-h-0 flex-1 flex-col"
      onValueChange={(value) => {
        if (isTab(value)) setTab(value)
      }}
      value={tab}
    >
      <div className="flex border-b border-border px-1.5 pt-1.5">
        <Tabs.List
          aria-label="Painel"
          className="flex min-w-0 flex-1 justify-between gap-0.5 overflow-x-auto"
        >
          {TABS.map(({ tab: value, label }) => (
            <Tabs.Trigger
              className="relative h-9 flex-none rounded-[8px] px-1.5 text-[12px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-100 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-1.5 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-foreground"
              key={value}
              value={value}
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>
      <Tabs.Content className="min-h-0 flex-1 overflow-y-auto p-3 outline-none" value="stats">
        <StatsTab />
      </Tabs.Content>
      <Tabs.Content className="min-h-0 flex-1 overflow-y-auto p-3 outline-none" value="events">
        <EventsTab moments={moments} />
      </Tabs.Content>
      <Tabs.Content className="min-h-0 flex-1 overflow-y-auto p-3 outline-none" value="player">
        <PlayerTab />
      </Tabs.Content>
      <Tabs.Content className="min-h-0 flex-1 overflow-y-auto p-3 outline-none" value="messages">
        <MessagesTab />
      </Tabs.Content>
      <Tabs.Content className="min-h-0 flex-1 overflow-y-auto p-3 outline-none" value="params">
        <ParamsTab />
      </Tabs.Content>
    </Tabs.Root>
  )
}

/** Props of {@link Panel}. */
export interface PanelProps {
  moments: Moment[]
  /** Width on wide screens, in CSS pixels. */
  width: number
  className?: string
}

/** The analysis panel: a card on the right on wide screens, a bottom sheet on a phone. */
export function Panel({ moments, width, className }: PanelProps) {
  const open = useReplay((s) => s.panelOpen)
  const setPanelOpen = useReplay((s) => s.setPanelOpen)
  const narrow = useNarrow()
  const style = useMemo(() => ({ width }), [width])

  if (narrow) {
    return (
      <Sheet onOpenChange={setPanelOpen} open={open}>
        <SheetContent className="h-[70svh]">
          <SheetTitle className="sr-only">Painel da partida</SheetTitle>
          <SheetDescription className="sr-only">
            Números, lances, jogador, mensagens e parâmetros.
          </SheetDescription>
          <PanelTabs moments={moments} />
        </SheetContent>
      </Sheet>
    )
  }
  if (!open) return null
  return (
    <aside
      aria-label="Painel da partida"
      className={cn(
        'fixed top-3 right-3 bottom-3 z-10 flex flex-col overflow-hidden rounded-[14px] bg-card text-card-foreground shadow-island',
        className,
      )}
      style={style}
    >
      <PanelTabs moments={moments} />
    </aside>
  )
}

/** Shows or hides the panel. */
export function PanelToggle() {
  const open = useReplay((s) => s.panelOpen)
  const setPanelOpen = useReplay((s) => s.setPanelOpen)
  return (
    <Hint label={open ? 'Fechar painel' : 'Abrir painel'} shortcut="I" side="bottom">
      <IslandButton
        aria-label="Painel da partida"
        aria-pressed={open}
        className={cn(open && 'bg-accent text-accent-foreground')}
        onClick={() => setPanelOpen(!open)}
      >
        <PanelRight aria-hidden className="size-4" />
      </IslandButton>
    </Hint>
  )
}
