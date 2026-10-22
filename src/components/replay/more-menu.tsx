import { CircleHelp, Crosshair, Ellipsis, Film, ImageDown, Moon, Sun, Unplug } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useReplay } from '@/player/store'

import { ClipDialog } from './clip-dialog'
import { download } from './download'
import { Hint, IslandButton } from './island'

function exportImage(): void {
  const { match, frame, name } = useReplay.getState()
  const cycle = match?.frames.cycle[Math.round(frame)] ?? 0
  const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-pitch]')
  canvas?.toBlob((blob) => {
    if (blob !== null) download(blob, `${name.replace(/\.rcg(?:\.gz)?$/i, '')}-ciclo-${cycle}.png`)
  }, 'image/png')
}

/** Props of {@link MoreMenu}. */
export interface MoreMenuProps {
  onHelp: () => void
  /** Adds "Seguir a bola", for screens where the zoom island is hidden. */
  follow?: boolean
}

/** The island's overflow: image and GIF export, theme and shortcuts, plus following the ball on a phone. */
export function MoreMenu({ onHelp, follow = false }: MoreMenuProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const following = useReplay((s) => s.follow === 'ball')
  const setFollow = useReplay((s) => s.setFollow)
  const connected = useReplay((s) => s.live !== null && s.live.phase !== 'ended')
  const disconnect = useReplay((s) => s.disconnect)
  const [clip, setClip] = useState(false)

  return (
    <>
      <DropdownMenu>
        <Hint label="Mais opções" side="bottom">
          <DropdownMenuTrigger asChild>
            <IslandButton aria-label="Mais opções">
              <Ellipsis aria-hidden className="size-4" />
            </IslandButton>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="min-w-52" sideOffset={8}>
          {follow ? (
            <>
              <DropdownMenuCheckboxItem
                checked={following}
                onCheckedChange={(checked) => setFollow(checked ? 'ball' : 'off')}
              >
                <Crosshair aria-hidden />
                Seguir a bola
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {connected ? (
            <>
              <DropdownMenuItem onSelect={disconnect}>
                <Unplug aria-hidden />
                Desconectar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onSelect={exportImage}>
            <ImageDown aria-hidden />
            Salvar imagem do campo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setClip(true)}>
            <Film aria-hidden />
            Salvar GIF do lance
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme(dark ? 'light' : 'dark')}>
            {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {dark ? 'Tema claro' : 'Tema escuro'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onHelp}>
            <CircleHelp aria-hidden />
            Atalhos
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ClipDialog onOpenChange={setClip} open={clip} />
    </>
  )
}
