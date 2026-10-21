import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SHORTCUTS } from '@/player/keys'

/** Props of {@link HelpDialog}. */
export interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The keyboard shortcuts and how to use the pitch. */
export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[min(460px,calc(100vw-24px))]">
        <div className="flex flex-col gap-1">
          <DialogTitle>Atalhos</DialogTitle>
          <DialogDescription>
            Clique num jogador para ver os números dele. Arraste para mover o campo e use a roda ou
            dois dedos para o zoom.
          </DialogDescription>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          {SHORTCUTS.map((shortcut) => (
            <div className="contents" key={shortcut.keys}>
              <dt>
                <kbd className="rounded-[6px] bg-muted px-1.5 py-0.5 font-mono text-[12px] whitespace-nowrap">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
