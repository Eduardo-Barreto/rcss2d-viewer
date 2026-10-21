import { Download, Flag, RotateCw, Undo2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'
import { teamName } from '@/player/format'
import { useReplay } from '@/player/store'
import { BEFORE_KICK_OFF } from '@/rcg/playmodes'
import type { LiveEnd } from '@/rcg/protocol'

import { download } from './download'
import { Hint, Island, IslandButton, IslandSeparator } from './island'

/** The red dot of a live broadcast. */
function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('size-2 flex-none rounded-full bg-destructive', className)} />
  )
}

/**
 * The live end of the transport: a badge while the playhead sits on the newest frame, a way
 * back to it otherwise, and the kick-off while the server waits for one.
 */
export function LiveControls() {
  const live = useReplay((s) => s.live)
  const waiting = useReplay(
    (s) =>
      s.match !== null && s.match.frames.playmode[s.match.frames.count - 1] === BEFORE_KICK_OFF,
  )
  const followLive = useReplay((s) => s.followLive)
  const kickOff = useReplay((s) => s.kickOff)
  if (live === null || live.phase === 'ended') return null
  return (
    <>
      <IslandSeparator />
      {live.following ? (
        <p className="flex h-9 items-center gap-1.5 px-2 text-[13px] font-medium phone:h-10">
          <LiveDot />
          Ao vivo
        </p>
      ) : (
        <Hint label="Voltar ao vivo" shortcut="End">
          <IslandButton onClick={followLive} variant="secondary">
            <Undo2 aria-hidden className="size-4" />
            Voltar ao vivo
          </IslandButton>
        </Hint>
      )}
      {waiting && live.server === 'up' ? (
        <IslandButton onClick={kickOff} variant="secondary">
          <Flag aria-hidden className="size-4" />
          Começar partida
        </IslandButton>
      ) : null}
    </>
  )
}

const ENDED: Record<LiveEnd, string> = {
  closed: 'A conexão com a ponte terminou.',
  unreachable: 'A ponte parou de responder.',
  full: 'O jogo chegou ao limite de quadros.',
  restarted: 'O servidor começou outra partida.',
  invalid: 'A ponte mandou algo que não é do monitor.',
}

/** `YYYYMMDDhhmm` out of an ISO date. */
const STAMP_LENGTH = 16

function fileName(): string {
  const { match } = useReplay.getState()
  const stamp = new Date().toISOString().slice(0, STAMP_LENGTH).replace(/[-:T]/g, '')
  if (match === null) return `ao-vivo-${stamp}.rcg.gz`
  return `${stamp}-${teamName(match, 'l')}-x-${teamName(match, 'r')}.rcg.gz`.replace(
    /[^\w.-]+/g,
    '_',
  )
}

function SaveButton() {
  const saveLive = useReplay((s) => s.saveLive)
  const [failed, setFailed] = useState(false)
  const save = async () => {
    const file = await saveLive()
    setFailed(file === null)
    if (file !== null) download(file, fileName())
  }
  return (
    <IslandButton onClick={() => void save()} variant="secondary">
      <Download aria-hidden className="size-4" />
      {failed ? 'Não deu para salvar' : 'Salvar .rcg'}
    </IslandButton>
  )
}

/** Props of {@link LiveNotice}. */
export interface LiveNoticeProps {
  className?: string
}

/**
 * Says what the live session is waiting for, or why it ended. After the end the frames stay,
 * and the notice offers to save them or to connect again.
 */
export function LiveNotice({ className }: LiveNoticeProps) {
  const live = useReplay((s) => s.live)
  const connect = useReplay((s) => s.connect)
  if (live === null) return null
  if (live.phase !== 'ended') {
    if (live.server === 'up') return null
    return (
      <Island className={cn('gap-2 px-3 py-2', className)} aria-live="polite">
        <LiveDot className="bg-warning" />
        <p className="text-[13px]">Ponte conectada. Esperando o rcssserver.</p>
      </Island>
    )
  }
  return (
    <Island
      className={cn('flex-wrap gap-x-2 gap-y-1 py-1 pr-1 pl-3', className)}
      aria-live="polite"
    >
      <p className="min-w-0 flex-1 text-[13px] text-pretty">
        {ENDED[live.end ?? 'closed']} Os quadros recebidos continuam aqui.
      </p>
      <div className="flex gap-1">
        <SaveButton />
        <IslandButton onClick={() => connect(live.url)} variant="ghost">
          <RotateCw aria-hidden className="size-4" />
          Reconectar
        </IslandButton>
      </div>
    </Island>
  )
}
