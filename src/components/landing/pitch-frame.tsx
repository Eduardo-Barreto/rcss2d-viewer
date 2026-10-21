import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * A box with the pitch's proportions (105 × 68 m plus the 5 m margin) that holds its height
 * before the canvas paints, so nothing below it moves.
 */
export function PitchFrame({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'relative aspect-[115/78] w-full overflow-hidden rounded-[18px] bg-background shadow-artboard',
        className,
      )}
    >
      {children}
    </div>
  )
}
