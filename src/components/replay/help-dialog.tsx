import { X } from 'lucide-react'
import { Fragment } from 'react'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { SHORTCUTS, type Shortcut } from '@/player/keys'

import { IslandButton } from './island'

/** Props of {@link HelpDialog}. */
export interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function Keys({ keys }: Pick<Shortcut, 'keys'>) {
  return (
    <span className="flex flex-wrap items-center gap-1 whitespace-nowrap">
      {keys.map((combo, index) => (
        <Fragment key={combo.join('+')}>
          {index > 0 ? <span className="px-0.5 text-[12px] text-muted-foreground">ou</span> : null}
          {combo.map((key) => (
            <kbd
              className="min-w-6 rounded-[6px] bg-muted px-1.5 py-0.5 text-center font-mono text-[12px]"
              key={key}
            >
              {key}
            </kbd>
          ))}
        </Fragment>
      ))}
    </span>
  )
}

/** The keyboard shortcuts and how to use the pitch. */
export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(480px,calc(100vw-24px))]">
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <DialogTitle>Atalhos</DialogTitle>
            <DialogDescription>
              Clique num jogador para ver os números dele. Arraste para mover o campo e use a roda
              ou dois dedos para o zoom.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <IslandButton aria-label="Fechar" className="-mt-1 -mr-1">
              <X aria-hidden className="size-4" />
            </IslandButton>
          </DialogClose>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[13px]">
          {SHORTCUTS.map((shortcut) => (
            <div className="contents" key={shortcut.label}>
              <dt>
                <Keys keys={shortcut.keys} />
              </dt>
              <dd className="text-muted-foreground">{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
