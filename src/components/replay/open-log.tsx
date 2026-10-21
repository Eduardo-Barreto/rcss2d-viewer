import { FileUp, Link2, LoaderCircle, Radio, TriangleAlert, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react'

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
      <p className="font-mono text-[12px] text-muted-foreground tabular-nums">
        {size(loaded)}
        {total === null ? '' : ` de ${size(total)}`}
      </p>
    </div>
  )
}

interface Address {
  url: string
  /** True from submitting until the next edit, so a failed read can point at the field. */
  sent: boolean
}

const BLANK: Address = { url: '', sent: false }
/** Where `just relay` listens by default. */
const RELAY: Address = { url: 'ws://127.0.0.1:6100', sent: false }

/** Props of {@link AddressForm}. */
interface AddressFormProps {
  errorId: string
  /** Kept by the parent, since the form unmounts while the log is read. */
  address: Address
  onAddress: (address: Address) => void
  onSubmit: (url: string) => void
  label: string
  placeholder: string
  action: ReactNode
}

/** An address field and its button, marked invalid when what it started failed. */
function AddressForm(props: AddressFormProps) {
  const { errorId, address, onAddress, onSubmit, label, placeholder, action } = props
  const failed = useReplay((s) => s.status === 'error')
  const clearError = useReplay((s) => s.clearError)
  const { url, sent } = address
  const id = useId()
  const invalid = sent && failed
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (url.trim() === '') return
    onAddress({ url, sent: true })
    onSubmit(url.trim())
  }
  return (
    <form className="flex w-full gap-1.5" onSubmit={submit}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-describedby={invalid ? errorId : undefined}
        aria-invalid={invalid}
        autoComplete="off"
        className="h-10 flex-1 rounded-[10px] text-base md:text-[13px]"
        id={id}
        inputMode="url"
        onChange={(event) => {
          onAddress({ url: event.target.value, sent: false })
          clearError()
        }}
        placeholder={placeholder}
        spellCheck={false}
        type="url"
        value={url}
      />
      <IslandButton className="h-10" disabled={url.trim() === ''} type="submit" variant="secondary">
        {action}
      </IslandButton>
    </form>
  )
}

/** After this long without a frame, the connecting screen says what usually holds it up. */
const SLOW_CONNECT_MS = 5000

/** Waiting for the relay and then for the first frame, with a hint when it takes long. */
function Connecting() {
  const url = useReplay((s) => s.live?.url ?? '')
  const relayUp = useReplay((s) => s.live?.phase === 'open')
  const close = useReplay((s) => s.close)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_CONNECT_MS)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="flex w-full flex-col gap-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <LoaderCircle aria-hidden className="size-4 animate-spin text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {relayUp ? 'Esperando o primeiro quadro' : `Conectando a ${url}`}
        </p>
        <IslandButton aria-label="Cancelar conexão" onClick={close}>
          <X aria-hidden className="size-4" />
        </IslandButton>
      </div>
      {slow ? (
        <p className="text-[12px] text-pretty text-muted-foreground">
          {relayUp
            ? 'A ponte está de pé, mas o rcssserver ainda não mandou nada. Ele está rodando na porta que a ponte usa?'
            : 'Confira se a ponte está rodando (just relay). O Chrome pode pedir permissão para acessar a rede local: aceite no aviso da barra de endereço.'}
        </p>
      ) : null}
    </div>
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
  const errorId = useId()
  const liveId = useId()
  const connect = useReplay((s) => s.connect)
  const connecting = useReplay((s) => s.live !== null)
  const [address, setAddress] = useState(BLANK)
  const [relay, setRelay] = useState(RELAY)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file !== undefined) void open({ kind: 'file', file, name: file.name })
  }

  return (
    <main className="fixed inset-0 grid place-items-center bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-3 rounded-[22px] border-2 border-dashed border-foreground/40 opacity-0 transition-opacity duration-150 ease-(--ease-out) data-on:opacity-100"
        data-on={dragging ? '' : undefined}
      />
      <Island className="w-[min(420px,calc(100vw-32px))] flex-col items-start gap-4 rounded-[18px] p-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]">rcssviewer</h1>
          <p className="text-[13px] text-pretty text-muted-foreground">
            Replay e análise de partidas da Soccer Simulation 2D. Solte um <code>.rcg</code> ou{' '}
            <code>.rcg.gz</code> aqui.
          </p>
        </div>
        {status === 'loading' && connecting ? <Connecting /> : null}
        {status === 'loading' && !connecting ? <Progress /> : null}
        {status === 'loading' ? null : (
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
            <AddressForm
              action={
                <>
                  <Link2 aria-hidden className="size-4" />
                  Abrir
                </>
              }
              address={address}
              errorId={errorId}
              label="Endereço https de um .rcg"
              onAddress={(next) => {
                setAddress(next)
                if (next.sent) setRelay({ ...relay, sent: false })
              }}
              onSubmit={(url) => void open({ kind: 'url', url })}
              placeholder="https://…/partida.rcg.gz"
            />
            <section aria-labelledby={liveId} className="flex w-full flex-col gap-2 border-t pt-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[13px] font-medium" id={liveId}>
                  Ao vivo
                </h2>
                <p className="text-[12px] text-pretty text-muted-foreground">
                  Acompanhe um rcssserver da sua máquina. Rode <code>just relay</code> no viewer e
                  conecte na ponte.
                </p>
              </div>
              <AddressForm
                action={
                  <>
                    <Radio aria-hidden className="size-4" />
                    Conectar
                  </>
                }
                address={relay}
                errorId={errorId}
                label="Endereço ws:// da ponte"
                onAddress={(next) => {
                  setRelay(next)
                  if (next.sent) setAddress({ ...address, sent: false })
                }}
                onSubmit={(url) => connect(url)}
                placeholder="ws://127.0.0.1:6100"
              />
            </section>
          </>
        )}
        {status === 'error' && error !== null ? (
          <p
            className="flex w-full items-start gap-2 rounded-[10px] bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
            id={errorId}
            role="alert"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none" />
            {error}
          </p>
        ) : null}
        <p className="text-[12px] text-pretty text-muted-foreground">
          O arquivo e a partida ao vivo ficam só no seu navegador. Nada é enviado.
        </p>
      </Island>
    </main>
  )
}
