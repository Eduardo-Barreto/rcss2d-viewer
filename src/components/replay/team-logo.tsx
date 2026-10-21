import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'
import type { GraphicTile } from '@/rcg/types'

/** Props of {@link TeamLogo}. */
export interface TeamLogoProps {
  tiles: GraphicTile[]
  className?: string
}

const MAX_SIDE = 256

/**
 * A team logo from the `team_graphic` tiles of the log, drawn on a canvas. The pixels come from
 * the decoded tiles only, so a hostile log can at most draw an odd picture.
 */
export function TeamLogo({ tiles, className }: TeamLogoProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const width = Math.min(MAX_SIDE, Math.max(0, ...tiles.map((t) => (t.x + 1) * t.width)))
  const height = Math.min(MAX_SIDE, Math.max(0, ...tiles.map((t) => (t.y + 1) * t.height)))

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    for (const tile of tiles) {
      const image = new ImageData(new Uint8ClampedArray(tile.rgba), tile.width, tile.height)
      ctx.putImageData(image, tile.x * tile.width, tile.y * tile.height)
    }
  }, [tiles, width, height])

  if (tiles.length === 0 || width === 0 || height === 0) return null
  return (
    <canvas
      aria-hidden
      className={cn('[image-rendering:pixelated]', className)}
      height={height}
      ref={canvas}
      width={width}
    />
  )
}
