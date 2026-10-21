import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** A floating island: card surface, 14 px corners, 4 px padding and the island shadow. */
export function Island({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'z-10 flex items-center gap-0.5 rounded-[14px] bg-card p-1 text-card-foreground shadow-island',
        className,
      )}
      {...props}
    />
  )
}

/** A ghost button inside an island, 36 px tall (40 px on a phone), with a small press. */
export function IslandButton({
  className,
  variant = 'ghost',
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        'h-9 min-w-9 gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium transition-[background-color,transform] duration-100 ease-(--ease) active:scale-[0.97] max-[720px]:h-10 max-[720px]:min-w-10 has-[>svg]:px-2.5',
        className,
      )}
      variant={variant}
      {...props}
    />
  )
}

/** A 1 × 20 px separator between groups of an island. */
export function IslandSeparator({ className }: { className?: string }) {
  return <span aria-hidden className={cn('mx-1 h-5 w-px flex-none bg-border', className)} />
}

/** Props of {@link Hint}. */
export interface HintProps {
  label: string
  shortcut?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
}

/** A tooltip with a control's name and its key in mono. */
export function Hint({ label, shortcut, side = 'top', children }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="text-xs font-medium" side={side} sideOffset={8}>
        {label}
        {shortcut === undefined ? null : (
          <kbd className="ml-3 font-mono text-[11px] text-background/70">{shortcut}</kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
