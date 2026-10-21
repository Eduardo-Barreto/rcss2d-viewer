import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useReplay } from '@/player/store'

const BOARD: Record<number, string> = { 1: 'placar', 2: 'log' }

/** Messages rendered at first and added per "Mostrar mais": a log can carry 20 thousand. */
export const MESSAGES_PAGE = 200

/** The `(msg ...)` lines of the log, shown as plain text, a page at a time. */
export function MessagesTab() {
  const match = useReplay((s) => s.match)
  const seek = useReplay((s) => s.seek)
  const [shown, setShown] = useState(MESSAGES_PAGE)
  const messages = match?.messages ?? []
  if (messages.length === 0) {
    return <p className="px-2 text-[13px] text-muted-foreground">Este log não tem mensagens.</p>
  }
  const left = messages.length - shown
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col">
        {messages.slice(0, shown).map((message, index) => (
          <li key={`${message.frame}-${index}`}>
            <button
              className="focus-ring-inset flex w-full flex-col gap-0.5 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-100 hover:bg-accent"
              onClick={() => seek(Math.min(message.frame, (match?.frames.count ?? 1) - 1))}
              type="button"
            >
              <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
                ciclo {message.cycle} · {BOARD[message.board] ?? `quadro ${message.board}`}
              </span>
              <span className="font-mono text-[12px] break-all whitespace-pre-wrap">
                {message.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {left > 0 ? (
        <Button
          className="self-center"
          onClick={() => setShown(shown + MESSAGES_PAGE)}
          size="sm"
          variant="outline"
        >
          Mostrar mais {Math.min(left, MESSAGES_PAGE)} de {left}
        </Button>
      ) : null}
    </div>
  )
}
