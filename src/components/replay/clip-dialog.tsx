import { X } from 'lucide-react'
import { type RefObject, useEffect, useId, useRef, useState } from 'react'

import type { Analysis } from '@/analysis/analyze'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type ClipCheck, checkClip, defaultClip } from '@/export/clip'
import { useReplay } from '@/player/store'
import type { Match } from '@/rcg/types'
import { readPalette } from '@/render/palette'

import { download } from './download'
import { IslandButton } from './island'

/** Props of {@link ClipDialog}. */
export interface ClipDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function fileName(name: string, from: number, to: number): string {
  return `${name.replace(/\.rcg(?:\.gz)?$/i, '') || 'partida'}-ciclo-${from}-${to}.gif`
}

const SECONDS = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function summary(check: ClipCheck, failure: string | null): { text: string; error: boolean } {
  if (failure !== null) return { text: failure, error: true }
  if (!check.ok) return { text: check.reason, error: true }
  return {
    text: `${check.frames} quadros, ${SECONDS.format(check.seconds)} s de jogo.`,
    error: false,
  }
}

interface Source {
  match: Match
  analysis: Analysis
  name: string
}

/** Runs one export at a time, with progress in 0..1 and cancel. */
function useClipExport(source: Source, onDone: () => void) {
  const [progress, setProgress] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const run = async (from: number, to: number) => {
    const controller = new AbortController()
    abort.current = controller
    setFailure(null)
    setProgress(0)
    try {
      const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
      if (ctx === null) throw new Error('O navegador não deu um canvas para desenhar.')
      const { exportClipGif } = await import('@/export/export')
      const clip = await exportClipGif(ctx, {
        match: source.match,
        analysis: source.analysis,
        palette: readPalette(document.documentElement),
        from,
        to,
        signal: controller.signal,
        onProgress: (done, total) => setProgress(done / total),
      })
      const blob = new Blob([new Uint8Array(clip.gif)], { type: 'image/gif' })
      download(blob, fileName(source.name, clip.from, clip.to))
      onDone()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setFailure(error instanceof Error ? error.message : String(error))
      }
    } finally {
      abort.current = null
      setProgress(null)
    }
  }

  return {
    progress,
    failure,
    run,
    cancel: () => abort.current?.abort(),
    reset: () => setFailure(null),
  }
}

interface CycleFieldProps {
  ref?: RefObject<HTMLInputElement | null>
  label: string
  value: string
  invalid: boolean
  disabled: boolean
  describedBy: string
  onChange: (value: string) => void
}

function CycleField({
  ref,
  label,
  value,
  invalid,
  disabled,
  describedBy,
  onChange,
}: CycleFieldProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        aria-describedby={describedBy}
        aria-invalid={invalid}
        className="tabular-nums"
        disabled={disabled}
        id={id}
        inputMode="numeric"
        min={0}
        onChange={(event) => onChange(event.target.value)}
        ref={ref}
        type="number"
        value={value}
      />
    </div>
  )
}

function Progress({ value, onCancel }: { value: number; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <progress
        aria-label="Desenhando o GIF"
        className="h-1.5 flex-1 appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-150"
        max={1}
        value={value}
      />
      <Button onClick={onCancel} type="button" variant="ghost">
        Cancelar
      </Button>
    </div>
  )
}

interface ClipFormProps extends Source {
  first: RefObject<HTMLInputElement | null>
  onDone: () => void
}

function ClipForm({ first, onDone, ...source }: ClipFormProps) {
  const statusId = useId()
  const [range, setRange] = useState(() => {
    const { frame } = useReplay.getState()
    const start = defaultClip(source.match, source.match.frames.cycle[Math.round(frame)] ?? 0)
    return { from: String(start.from), to: String(start.to) }
  })
  const job = useClipExport(source, onDone)
  const check = checkClip(source.match, source.analysis.physics.stepMs, range.from, range.to)
  const status = summary(check, job.failure)
  const running = job.progress !== null
  const edit = (next: typeof range) => {
    job.reset()
    setRange(next)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (check.ok) void job.run(Number(range.from), Number(range.to))
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <CycleField
          describedBy={statusId}
          disabled={running}
          invalid={!check.ok}
          label="Do ciclo"
          ref={first}
          onChange={(from) => edit({ ...range, from })}
          value={range.from}
        />
        <CycleField
          describedBy={statusId}
          disabled={running}
          invalid={!check.ok}
          label="Até o ciclo"
          onChange={(to) => edit({ ...range, to })}
          value={range.to}
        />
      </div>
      <p
        aria-live="polite"
        className={`text-[13px] ${status.error ? 'text-destructive' : 'text-muted-foreground tabular-nums'}`}
        id={statusId}
      >
        {status.text}
      </p>
      {job.progress === null ? (
        <Button className="self-end" disabled={!check.ok} type="submit">
          Gerar GIF
        </Button>
      ) : (
        <Progress onCancel={job.cancel} value={job.progress} />
      )}
    </form>
  )
}

/** Range picker and progress for "Salvar GIF do lance". Draws with the pitch's own renderer. */
export function ClipDialog({ open, onOpenChange }: ClipDialogProps) {
  const match = useReplay((s) => s.match)
  const analysis = useReplay((s) => s.analysis)
  const name = useReplay((s) => s.name)
  const first = useRef<HTMLInputElement>(null)
  if (match === null || analysis === null) return null

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="w-[min(400px,calc(100vw-24px))]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          first.current?.focus()
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <DialogTitle>Salvar GIF do lance</DialogTitle>
            <DialogDescription>
              O campo inteiro em tempo real, com placar e ciclo, para colar numa issue ou num post.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <IslandButton aria-label="Fechar" className="-mt-1 -mr-1">
              <X aria-hidden className="size-4" />
            </IslandButton>
          </DialogClose>
        </div>
        {open ? (
          <ClipForm
            analysis={analysis}
            first={first}
            match={match}
            name={name}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
