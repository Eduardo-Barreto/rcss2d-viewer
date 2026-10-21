import { useReplay } from '@/player/store'

const BOARD: Record<number, string> = { 1: 'placar', 2: 'log' }

/** The `(msg ...)` lines of the log, shown as plain text. */
export function MessagesTab() {
  const match = useReplay((s) => s.match)
  const seek = useReplay((s) => s.seek)
  const messages = match?.messages ?? []
  if (messages.length === 0) {
    return <p className="px-2 text-[13px] text-muted-foreground">Este log não tem mensagens.</p>
  }
  return (
    <ul className="flex flex-col">
      {messages.map((message, index) => (
        <li key={`${message.frame}-${index}`}>
          <button
            className="flex w-full flex-col gap-0.5 rounded-[8px] px-2 py-1.5 text-left transition-colors duration-100 hover:bg-accent"
            onClick={() => seek(Math.min(message.frame, (match?.frames.count ?? 1) - 1))}
            type="button"
          >
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              ciclo {message.cycle} · {BOARD[message.board] ?? `quadro ${message.board}`}
            </span>
            <span className="font-mono text-[12px] break-all whitespace-pre-wrap">
              {message.text}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
