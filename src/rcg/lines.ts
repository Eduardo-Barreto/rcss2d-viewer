import { decodeTile } from './graphic'
import { Char, type Scanner } from './scanner'
import type { GraphicTile, ParamMap, Side } from './types'

const MAX_NAME_LENGTH = 64
const MAX_SCORE = 65535
const MAX_PARAMS = 1024
const MAX_PARAM_STRING = 1024
const INVISIBLE_CHARS = /[\p{Cc}\p{Cf}]/gu
const GRAPHIC_PREFIX = /^\(team_graphic_(?<side>[lr]) \(\s*(?<x>\d+)\s+(?<y>\d+)\s/
const QUOTED = /"(?<part>[^"]*)"/g

/**
 * Replaces control and format characters (bidi overrides, zero-width marks) and caps the length
 * of any text that came from the log, so a team name cannot reorder the text around it.
 */
export function cleanText(text: string, max: number): string {
  return text.replace(INVISIBLE_CHARS, ' ').slice(0, max)
}

/** Reads a `(name value)` sequence until the closing parenthesis of the block. */
export function readParams(s: Scanner): ParamMap {
  const params: ParamMap = new Map()
  while (s.peek() === Char.OPEN) {
    s.pos++
    const name = cleanText(s.token(), MAX_NAME_LENGTH)
    const value = s.peek() === Char.QUOTE ? s.quoted() : s.token()
    const numeric = Number(value)
    params.set(
      name,
      Number.isFinite(numeric) && value !== '' ? numeric : cleanText(value, MAX_PARAM_STRING),
    )
    s.expect(Char.CLOSE)
    if (params.size > MAX_PARAMS) s.fail('parâmetros demais')
  }
  s.expect(Char.CLOSE)
  return params
}

/** Fields of a `(team <time> <left> <right> <scoreL> <scoreR> [penalties])` line. */
export interface TeamLine {
  leftName: string
  rightName: string
  scores: number[]
}

function teamName(token: string): string {
  return token === 'null' ? '' : cleanText(token, MAX_NAME_LENGTH)
}

/**
 * Reads a team line after the time, as written by `SerializerMonitorStdv3::serializeTeam`
 * (rcssserver `src/serializermonitor.cpp:124`). The four penalty fields only appear once a
 * penalty was taken.
 */
export function readTeam(s: Scanner): TeamLine {
  const leftName = teamName(s.token())
  const rightName = teamName(s.token())
  const scores: number[] = []
  while (s.peek() !== Char.CLOSE) scores.push(s.int(0, MAX_SCORE))
  if (scores.length !== 2 && scores.length !== 2 + 2 + 2) s.fail('placar com campos a mais')
  s.expect(Char.CLOSE)
  return { leftName, rightName, scores }
}

/** A team logo tile found in a message. */
export interface GraphicMessage {
  side: Side
  tile: GraphicTile
}

/**
 * Splits the text of a `(msg <time> <board> "<text>")` line. The server does not escape quotes
 * (`DispSenderLoggerV4::sendMsg`, `src/dispsender.cpp:1030`), so like librcsc's
 * `parser_v4.cpp:655` the text runs from the first quote to the last `")`.
 */
export function messageText(s: Scanner): string {
  const start = s.text.indexOf('"', s.pos)
  const end = s.text.lastIndexOf('")')
  if (start === -1 || end <= start) s.fail('mensagem sem texto entre aspas')
  return s.text.slice(start + 1, end)
}

/** Parses a team graphic message, or returns `null` when it is not one or is malformed. */
export function readGraphic(text: string): GraphicMessage | null {
  const head = GRAPHIC_PREFIX.exec(text)
  const side = head?.groups?.side
  if (head === null || (side !== 'l' && side !== 'r')) return null
  const parts = [...text.slice(head[0].length).matchAll(QUOTED)].map((m) => m.groups?.part ?? '')
  const tile = decodeTile(Number(head.groups?.x), Number(head.groups?.y), parts)
  return tile === null ? null : { side, tile }
}
