import type { LogSource } from './source'
import type { Match } from './types'

/** Message the page sends to the parser worker. */
export interface LoadRequest {
  source: LogSource
}

/** Messages the parser worker sends back. */
export type LoadReply =
  | { kind: 'progress'; loaded: number; total: number | null }
  | { kind: 'done'; match: Match }
  | { kind: 'error'; message: string }
