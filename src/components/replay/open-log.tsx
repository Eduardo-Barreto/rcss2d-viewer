import { FileUp, Link2, LoaderCircle, TriangleAlert, X } from 'lucide-react'
import { type FormEvent, useId, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { useReplay } from '@/player/store'

import { Island, IslandButton } from './island'

const MIB = 1_048_576

function size(bytes: number): string {
  return `${(bytes / MIB).toFixed(1).replace('.', ',')} MB`
}

function Progress() {
  const { loaded, total } = useReplay((s) => s.progress)
  const name = useReplay((s) => s.name)
  const close = useReplay((s) => s.close)
  const share = total === null ? null : Math.min(1, loaded / total)
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <LoaderCircle aria-hidden className="size-4 animate-spin text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">Lendo {name}</p>
        <IslandButton aria-label="Cancelar leitura" onClick={close}>
          <X aria-hidden className="size-4" />
        </IslandButton>
      </div>
      <progress
        aria-label="Progresso da leitura"
        className="h-1 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-foreground [&::-webkit-progress-value]:transition-[width]"
        max={1}
        value={share ?? undefined}
      />
      <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {size(loaded)}
        {total === null ? '' : ` de ${size(total)}`}
      </p>
    </div>
  )
}

function UrlForm() {
  const open = useReplay((s) => s.open)
  const [url, setUrl] = useState('')
  const id = useId()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (url.trim() !== '') void open({ kind: 'url', url: url.trim() })
  }
  return (
    <form className="flex w-full gap-1.5" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>
        Endereço https de um .rcg
      </label>
      <Input
        autoComplete="off"
        className="h-9 flex-1 rounded-[10px] text-[13px]"
        id={id}
        inputMode="url"
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://…/partida.rcg.gz"
        spellCheck={false}
        type="url"
        value={url}
      />
      <IslandButton disabled={url.trim() === ''} type="submit" variant="secondary">
        <Link2 aria-hidden className="size-4" />
        Abrir
      </IslandButton>
    </form>
  )
}

/** Props of {@link OpenLog}. */
export interface OpenLogProps {
  /** True while a file is dragged over the window. */
  dragging: boolean
}

/** The first screen: pick, drop or link a log. Also shows the reading progress and errors. */
export function OpenLog({ dragging }: OpenLogProps) {
  const status = useReplay((s) => s.status)
  const error = useReplay((s) => s.error)
  const open = useReplay((s) => s.open)
  const input = useRef<HTMLInputElement>(null)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file !== undefined) void open({ kind: 'file', file, name: file.name })
  }

  return (
    <main className="fixed inset-0 grid place-items-center bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-3 rounded-[22px] border-2 border-dashed border-foreground/15 opacity-0 transition-opacity duration-150 ease-(--ease) data-on:opacity-100"
        data-on={dragging ? '' : undefined}
      />
      <Island className="w-[min(420px,calc(100vw-32px))] flex-col items-start gap-4 rounded-[18px] p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[15px] leading-5 font-semibold">rcssmonitor</h1>
          <p className="text-[13px] text-pretty text-muted-foreground">
            Replay e análise de partidas da Soccer Simulation 2D. Solte um <code>.rcg</code> ou{' '}
            <code>.rcg.gz</code> aqui.
          </p>
        </div>
        {status === 'loading' ? (
          <Progress />
        ) : (
          <>
            <IslandButton
              className="h-11 w-full justify-center"
              onClick={() => input.current?.click()}
              variant="default"
            >
              <FileUp aria-hidden className="size-4" />
              Escolher arquivo
            </IslandButton>
            <input
              accept=".rcg,.gz,application/gzip"
              aria-label="Arquivo .rcg"
              className="hidden"
              onChange={(event) => pick(event.target.files)}
              ref={input}
              tabIndex={-1}
              type="file"
            />
            <UrlForm />
          </>
        )}
        {status === 'error' && error !== null ? (
          <p
            className="flex w-full items-start gap-2 rounded-[10px] bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
            role="alert"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none" />
            {error}
          </p>
        ) : null}
        <p className="text-[12px] text-pretty text-muted-foreground">
          O arquivo é lido só no seu navegador. Nada é enviado.
        </p>
      </Island>
    </main>
  )
}
