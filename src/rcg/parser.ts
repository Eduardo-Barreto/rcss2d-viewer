import { FrameStore } from './columns'
import { cleanText, messageText, readGraphic, readParams, readTeam } from './lines'
import { playModeId } from './playmodes'
import { Char, RcgError, RcgSyntaxError, Scanner } from './scanner'
import { readShowBody } from './show'
import type { GraphicTile, LogMessage, Match, ParamMap, PlayModeChange, ScoreChange } from './types'

/** Hard limits on what one log may contain. Past any of them the log is refused. */
export interface RcgLimits {
  /** Bytes after decompression. */
  maxBytes: number
  /** Characters in one line. */
  maxLineLength: number
  /** `(show ...)` lines. */
  maxFrames: number
  /** `(msg ...)` lines kept; the rest are counted and dropped. */
  maxMessages: number
  /** `(playmode ...)` and `(team ...)` changes kept, each; the rest are counted and dropped. */
  maxEvents: number
}

const MIB = 1_048_576
const MAX_BYTES_MIB = 512
const MAX_FRAMES = 40_000
const MAX_MESSAGES = 20_000
const MAX_EVENTS = 20_000
const MAX_MESSAGE_LENGTH = 2000
const MAX_TILES_PER_SIDE = 512
const MAX_PLAYER_TYPES = 64
const MAX_CYCLE = 1_000_000
const MAX_BOARD = 16

/** Limits used by the app. A full match with extra time and penalties is about 13k frames. */
export const DEFAULT_LIMITS: RcgLimits = {
  maxBytes: MAX_BYTES_MIB * MIB,
  maxLineLength: 1 * MIB,
  maxFrames: MAX_FRAMES,
  maxMessages: MAX_MESSAGES,
  maxEvents: MAX_EVENTS,
}

const FIRST_TEXT_VERSION = 4
const LAST_TEXT_VERSION = 6
const HEADER = /^ULG(?<version>\d+)\s*$/

/**
 * Reads the header line. The text versions are 4 to 6, written by
 * `InitSenderLoggerV4..V6` (rcssserver `src/initsenderlogger.cpp:384,471,511`).
 */
function readHeader(line: string): number {
  const version = Number(HEADER.exec(line)?.groups?.version)
  if (!Number.isInteger(version)) {
    throw new RcgError('Não parece um .rcg: a primeira linha deveria ser ULG4, ULG5 ou ULG6.')
  }
  if (version < FIRST_TEXT_VERSION || version > LAST_TEXT_VERSION) {
    throw new RcgError(`Versão ${version} do .rcg não é suportada. Use a 4, 5 ou 6.`)
  }
  return version
}

/**
 * Turns the lines of a text `.rcg` into a {@link Match}, one line at a time, so the caller can
 * stream a file without holding it whole. Lines of unknown type are counted and skipped, the
 * same as librcsc's `parser_v4.cpp:158`.
 */
export class RcgParser {
  private readonly store: FrameStore
  private version = 0
  private lineNumber = 0
  private leftName = ''
  private rightName = ''
  private mode = 0
  private score: ScoreChange | null = null
  private skippedLines = 0
  private readonly playmodes: PlayModeChange[] = []
  private readonly scores: ScoreChange[] = []
  private readonly messages: LogMessage[] = []
  private readonly graphics = {
    l: new Map<string, GraphicTile>(),
    r: new Map<string, GraphicTile>(),
  }
  private serverParams: ParamMap = new Map()
  private playerParams: ParamMap = new Map()
  private readonly playerTypes: ParamMap[] = []

  private readonly limits: RcgLimits

  constructor(limits: RcgLimits = DEFAULT_LIMITS) {
    this.limits = limits
    this.store = new FrameStore(limits.maxFrames)
  }

  /**
   * Feeds the text after the last newline. A log cut while it was written ends in half a line,
   * so a last line that does not parse is counted as skipped instead of refusing the log.
   */
  pushLast(line: string): void {
    if (this.version === 0) {
      this.push(line)
      return
    }
    try {
      this.push(line)
    } catch (error) {
      if (!(error instanceof RcgSyntaxError)) throw error
      this.skippedLines++
    }
  }

  /** Feeds one line, without its newline. */
  push(line: string): void {
    this.lineNumber++
    if (line.length > this.limits.maxLineLength) {
      throw new RcgError(`Linha ${this.lineNumber} passa do limite de tamanho.`)
    }
    if (this.version === 0) {
      this.version = readHeader(line)
      return
    }
    if (line.trim() === '') return
    const s = new Scanner(line, this.lineNumber)
    s.expect(Char.OPEN)
    this.dispatch(s, s.token())
  }

  private dispatch(s: Scanner, kind: string): void {
    switch (kind) {
      case 'show':
        this.show(s)
        return
      case 'playmode':
        this.playmode(s)
        return
      case 'team':
        this.team(s)
        return
      case 'msg':
        this.message(s)
        return
      default:
        this.params(s, kind)
    }
  }

  private params(s: Scanner, kind: string): void {
    if (kind === 'server_param') this.serverParams = readParams(s)
    else if (kind === 'player_param') this.playerParams = readParams(s)
    else if (kind === 'player_type' && this.playerTypes.length < MAX_PLAYER_TYPES) {
      this.playerTypes.push(readParams(s))
    } else this.skippedLines++
  }

  private show(s: Scanner): void {
    const cycle = s.int(0, MAX_CYCLE)
    const frame = this.store.add()
    if (frame === -1) {
      throw new RcgError(`O log passa de ${this.limits.maxFrames} quadros.`)
    }
    try {
      readShowBody(s, this.store, frame)
    } catch (error) {
      this.store.dropLast()
      throw error
    }
    const f = this.store.columns
    f.cycle[frame] = cycle
    f.playmode[frame] = this.mode
    f.scoreLeft[frame] = this.score?.left ?? 0
    f.scoreRight[frame] = this.score?.right ?? 0
  }

  private playmode(s: Scanner): void {
    const cycle = s.int(0, MAX_CYCLE)
    const name = s.token()
    const mode = playModeId(name)
    if (mode === undefined) {
      this.skippedLines++
      return
    }
    this.mode = mode
    if (this.playmodes.length >= this.limits.maxEvents) {
      this.skippedLines++
      return
    }
    this.playmodes.push({ frame: this.store.count, cycle, mode })
  }

  private team(s: Scanner): void {
    const cycle = s.int(0, MAX_CYCLE)
    const { leftName, rightName, scores } = readTeam(s)
    this.leftName = leftName || this.leftName
    this.rightName = rightName || this.rightName
    const [left = 0, right = 0, penLeft = 0, missLeft = 0, penRight = 0, missRight = 0] = scores
    const change: ScoreChange = {
      frame: this.store.count,
      cycle,
      left,
      right,
      penaltiesLeft: penLeft,
      penaltiesRight: penRight,
      penaltyMissesLeft: missLeft,
      penaltyMissesRight: missRight,
    }
    this.score = change
    if (this.scores.length >= this.limits.maxEvents) {
      this.skippedLines++
      return
    }
    this.scores.push(change)
  }

  private message(s: Scanner): void {
    const cycle = s.int(0, MAX_CYCLE)
    const board = s.int(0, MAX_BOARD)
    const text = messageText(s)
    const graphic = readGraphic(text)
    if (graphic !== null) {
      const tiles = this.graphics[graphic.side]
      if (tiles.size < MAX_TILES_PER_SIDE) {
        tiles.set(`${graphic.tile.x},${graphic.tile.y}`, graphic.tile)
      }
      return
    }
    if (this.messages.length >= this.limits.maxMessages) {
      this.skippedLines++
      return
    }
    this.messages.push({
      frame: this.store.count,
      cycle,
      board,
      text: cleanText(text, MAX_MESSAGE_LENGTH),
    })
  }

  /** Closes the log and returns the match. Fails if no frame was read. */
  finish(): Match {
    if (this.version === 0) throw new RcgError('O arquivo está vazio.')
    if (this.store.count === 0) throw new RcgError('O log não tem nenhum quadro (show).')
    const last = this.store.count - 1
    const clamp = <T extends { frame: number }>(entry: T): T => ({
      ...entry,
      frame: Math.min(entry.frame, last),
    })
    return {
      version: this.version,
      leftName: this.leftName,
      rightName: this.rightName,
      frames: this.store.finish(),
      playmodes: this.playmodes.map(clamp),
      scores: this.scores.map(clamp),
      messages: this.messages.map(clamp),
      graphics: { l: [...this.graphics.l.values()], r: [...this.graphics.r.values()] },
      serverParams: this.serverParams,
      playerParams: this.playerParams,
      playerTypes: this.playerTypes,
      skippedLines: this.skippedLines,
    }
  }
}

/** Parses a whole log held in memory. Meant for tests and small inputs. */
export function parseRcgText(text: string, limits: RcgLimits = DEFAULT_LIMITS): Match {
  if (text.length > limits.maxBytes) throw new RcgError('O log passa do limite de tamanho.')
  const parser = new RcgParser(limits)
  const lines = text.split('\n')
  const last = lines.pop() ?? ''
  for (const line of lines) parser.push(line)
  parser.pushLast(last)
  return parser.finish()
}
