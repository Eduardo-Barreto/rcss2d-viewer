import type { MatchDelta } from './parser'
import type { LogSource } from './source'
import type { Match } from './types'

/** Command a page may send to the server through the relay. */
export type LiveCommand = '(dispstart)'

/** Messages the page sends to the parser worker. */
export type WorkerRequest =
  | { kind: 'load'; source: LogSource }
  | { kind: 'live'; url: string }
  | { kind: 'command'; command: LiveCommand }
  | { kind: 'stop' }
  | { kind: 'save' }

/** Why a live session ended. */
export type LiveEnd =
  /** The relay closed the connection or went away. */
  | 'closed'
  /** The relay never answered. */
  | 'unreachable'
  /** The match reached the frame limit. */
  | 'full'
  /** The server started a new match, so these frames belong to the old one. */
  | 'restarted'
  /** The relay sent something that is not a monitor line. */
  | 'invalid'

/** Messages the parser worker sends back while reading a file. */
export type LoadReply =
  | { kind: 'progress'; loaded: number; total: number | null }
  | { kind: 'done'; match: Match }
  | { kind: 'error'; message: string }

/** Messages the parser worker sends back during a live session. */
export type LiveReply =
  | { kind: 'live-open'; server: 'up' | 'down' }
  | { kind: 'live-delta'; delta: MatchDelta }
  | { kind: 'live-end'; reason: LiveEnd }
  /** The match as a gzipped `.rcg`, null when it cannot be saved. */
  | { kind: 'live-saved'; file: Blob | null }
