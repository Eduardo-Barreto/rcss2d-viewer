import { Crosshair, Minus, Plus } from 'lucide-react'

import { ZOOM_STEP, useCamera } from '@/player/camera-store'
import { useReplay } from '@/player/store'

import { Hint, Island, IslandButton, IslandSeparator } from './island'

const PERCENT = 100

/** Zoom out, the zoom level (press to fit the pitch), zoom in and follow the ball. */
export function Zoom({ className }: { className?: string }) {
  const zoom = useCamera((s) => Math.round((s.camera.scale / s.camera.fitScale) * PERCENT))
  const zoomBy = useCamera((s) => s.zoomBy)
  const refit = useCamera((s) => s.refit)
  const follow = useReplay((s) => s.follow)
  const setFollow = useReplay((s) => s.setFollow)
  const following = follow === 'ball'

  return (
    <Island className={className}>
      <Hint label="Afastar" shortcut="−">
        <IslandButton aria-label="Afastar" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <Minus aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
      <Hint label="Enquadrar o campo" shortcut="0">
        <IslandButton
          aria-label={`Zoom ${zoom}%. Enquadrar o campo`}
          className="min-w-14 font-mono text-[12px] tabular-nums"
          onClick={refit}
        >
          {zoom}%
        </IslandButton>
      </Hint>
      <Hint label="Aproximar" shortcut="+">
        <IslandButton aria-label="Aproximar" onClick={() => zoomBy(ZOOM_STEP)}>
          <Plus aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
      <IslandSeparator />
      <Hint label={following ? 'Parar de seguir a bola' : 'Seguir a bola'} shortcut="F">
        <IslandButton
          aria-label="Seguir a bola"
          aria-pressed={following}
          onClick={() => setFollow(following ? 'off' : 'ball')}
        >
          <Crosshair aria-hidden className="size-4" />
        </IslandButton>
      </Hint>
    </Island>
  )
}
