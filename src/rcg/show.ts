import type { FrameStore } from './columns'
import { type TeamLine, readTeam } from './lines'
import { PLAYMODES } from './playmodes'
import { Char, type Scanner } from './scanner'
import { BALL_STRIDE, COUNTERS, type FrameColumns, PLAYERS_PER_SIDE, SLOT_COUNT } from './types'

const MAX_PLAYER_TYPE = 127
const MAX_STATE = 0xffffffff
const BALL_TAG = '((b)'
const PM_TAG = '(pm '
const TM_TAG = '(tm '
const CHAR_ZERO = 48
const CHAR_NINE = 57
const CHAR_MINUS = 45
const CHAR_DOT = 46
const SNIPPET_LENGTH = 8

/** Slot index of a player: left 0..10, right 11..21. */
function slotOf(side: string, unum: number): number {
  return (side === 'l' ? 0 : PLAYERS_PER_SIDE) + unum - 1
}

function isNumberStart(code: number): boolean {
  return (code >= CHAR_ZERO && code <= CHAR_NINE) || code === CHAR_MINUS || code === CHAR_DOT
}

function readSlot(s: Scanner): number {
  s.expect(Char.OPEN)
  s.expect(Char.OPEN)
  const side = s.token()
  if (side !== 'l' && side !== 'r') s.fail(`lado inválido "${side.slice(0, SNIPPET_LENGTH)}"`)
  const unum = s.int(1, PLAYERS_PER_SIDE)
  s.expect(Char.CLOSE)
  return slotOf(side, unum)
}

function readFocus(s: Scanner): number {
  const side = s.token()
  const unum = s.int(1, PLAYERS_PER_SIDE)
  if (side !== 'l' && side !== 'r') s.fail('lado inválido no foco')
  return slotOf(side, unum)
}

function readCounts(s: Scanner, f: FrameColumns, base: number): void {
  for (let i = 0; i < COUNTERS.length && s.peek() !== Char.CLOSE; i++) {
    f.counts[base * COUNTERS.length + i] = s.int(0, MAX_STATE)
  }
}

function readStamina(s: Scanner, f: FrameColumns, k: number): void {
  const p = f.players
  p.stamina[k] = s.number()
  p.effort[k] = s.number()
  p.recovery[k] = s.number()
  p.capacity[k] = s.peek() === Char.CLOSE ? Number.NaN : s.number()
}

/** One `(tag ...)` group inside a player, after the position fields. */
function readPlayerGroup(s: Scanner, f: FrameColumns, k: number): void {
  s.expect(Char.OPEN)
  const tag = s.token()
  const p = f.players
  switch (tag) {
    case 'v':
      f.viewHigh[k] = s.token() === 'h' ? 1 : 0
      p.viewWidth[k] = s.number()
      break
    case 'fp':
      p.focusDist[k] = s.number()
      p.focusDir[k] = s.number()
      break
    case 's':
      readStamina(s, f, k)
      break
    case 'f':
      f.focusTarget[k] = readFocus(s)
      break
    case 'c':
      readCounts(s, f, k)
      break
    default:
      s.skipGroup()
      return
  }
  s.expect(Char.CLOSE)
}

function readPlayer(s: Scanner, f: FrameColumns, frame: number): void {
  const k = frame * SLOT_COUNT + readSlot(s)
  const p = f.players
  f.type[k] = s.int(0, MAX_PLAYER_TYPE)
  f.state[k] = s.int(0, MAX_STATE)
  p.x[k] = s.number()
  p.y[k] = s.number()
  p.vx[k] = s.number()
  p.vy[k] = s.number()
  p.body[k] = s.number()
  p.neck[k] = s.number()
  const pointing = isNumberStart(s.peek())
  p.pointX[k] = pointing ? s.number() : Number.NaN
  p.pointY[k] = pointing ? s.number() : Number.NaN
  p.capacity[k] = Number.NaN
  while (s.peek() === Char.OPEN) readPlayerGroup(s, f, k)
  s.expect(Char.CLOSE)
}

function readBall(s: Scanner, f: FrameColumns, frame: number): void {
  s.pos += BALL_TAG.length
  const at = frame * BALL_STRIDE
  for (let i = 0; i < BALL_STRIDE; i++) f.ball[at + i] = s.number()
  s.expect(Char.CLOSE)
}

/** What a show line says beyond the frame itself, when it carries it. */
export interface ShowExtras {
  /** Play mode id from `(pm N)`, or null when the line has none. */
  mode: number | null
  /** Teams and score from `(tm ...)`, or null when the line has none. */
  team: TeamLine | null
}

/**
 * Reads the body of a `(show <time> ...)` line after the time, following
 * `DispSenderLoggerV4::sendShow` (rcssserver `src/dispsender.cpp:1002`). A monitor connection
 * gets the same body from `DispSenderMonitorV3::sendShow` (`src/dispsender.cpp:443`) with
 * `(pm N)` and `(tm ...)` up front, the only place a live monitor learns the play mode and the
 * score: `Monitor::sendPlayMode` and `sendScore` (`src/monitor.cpp:190-221`) are never called.
 * Files from version 4 on carry those in their own lines instead.
 */
export function readShowBody(s: Scanner, store: FrameStore, frame: number): ShowExtras {
  const f = store.columns
  const extras: ShowExtras = { mode: null, team: null }
  let sawBall = false
  while (s.peek() === Char.OPEN) {
    if (s.startsWith(BALL_TAG)) {
      readBall(s, f, frame)
      sawBall = true
    } else if (s.startsWith('((')) {
      readPlayer(s, f, frame)
    } else if (s.startsWith(PM_TAG)) {
      s.pos += PM_TAG.length
      extras.mode = s.int(0, PLAYMODES.length - 1)
      s.expect(Char.CLOSE)
    } else if (s.startsWith(TM_TAG)) {
      s.pos += TM_TAG.length
      extras.team = readTeam(s)
    } else {
      s.pos++
      s.skipGroup()
    }
  }
  s.expect(Char.CLOSE)
  if (!sawBall) s.fail('quadro sem bola')
  return extras
}
