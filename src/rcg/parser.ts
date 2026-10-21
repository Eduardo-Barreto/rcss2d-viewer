import { FrameStore } from './columns'
import { type TeamLine, cleanText, messageText, readGraphic, readParams, readTeam } from './lines'
import { playModeId } from './playmodes'
import { Char, RcgError, RcgSyntaxError, Scanner } from './scanner'
import { type ShowExtras, readShowBody } from './show'
import type {
  FrameColumns,
  GraphicTile,
  LogMessage,
  Match,
  ParamMap,
  PlayModeChange,
  ScoreChange,
} from './types'

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
/** Log version whose lines match what monitor protocol 5 sends (`src/logger.cpp:166-170`). */
const MONITOR_LOG_VERSION = 6
const BEFORE_KICK_OFF = playModeId('before_kick_off')
const TIME_OVER = playModeId('time_over')

/** Where the lines come from. */
export type LineSource = 'file' | 'monitor'

/**
 * What arrived since the last {@link RcgParser.drain}: the frames from `from` on (a frame
 * already sent may be in it again, rewritten) and the entries added after the last drain.
 */
export interface MatchDelta {
  from: number
  frames: FrameColumns
  leftName: string
  rightName: string
  playmodes: PlayModeChange[]
  scores: ScoreChange[]
  messages: LogMessage[]
  /** Every logo tile, only when one changed. */
  graphics: Match['graphics'] | null
  /** The parameter blocks, only when one changed. */
  params: Pick<Match, 'serverParams' | 'playerParams' | 'playerTypes'> | null
  skippedLines: number
}
const HEADER = /^ULG(?<version>\d+)\s*$/

/**
 * Reads the header line. The text versions are 4 to 6, written by
 * `InitSenderLoggerV4..V6` (rcssserver `src/initsenderlogger.cpp:384,471,511`).
 */
function readHeader(line: string): number {
  const version = Number(HEADER.exec(line)?.groups?.version)
  if (!Number.isInteger(version)) {
    throw new RcgError(
      'Esse arquivo não parece um replay. Escolha um .rcg ou .rcg.gz gravado pelo rcssserver.',
    )
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
  private readonly sent = { frames: 0, playmodes: 0, scores: 0, messages: 0 }
  private dirtyFrom = 0
  private graphicsChanged = false
  private paramsChanged = false

  private readonly limits: RcgLimits
  private readonly source: LineSource

  /**
   * A `'file'` parser expects the `ULG` header first. A `'monitor'` parser reads what a monitor
   * connection sends, which has no header and repeats the frame while the clock is stopped.
   */
  constructor(limits: RcgLimits = DEFAULT_LIMITS, source: LineSource = 'file') {
    this.limits = limits
    this.source = source
    this.store = new FrameStore(limits.maxFrames)
    if (source === 'monitor') this.version = MONITOR_LOG_VERSION
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
    } else {
      this.skippedLines++
      return
    }
    this.paramsChanged = true
  }

  private show(s: Scanner): void {
    const cycle = s.int(0, MAX_CYCLE)
    const frame = this.store.add()
    if (frame === -1) {
      throw new RcgError(`O log passa de ${this.limits.maxFrames} quadros.`)
    }
    let extras
    try {
      extras = readShowBody(s, this.store, frame)
    } catch (error) {
      this.store.dropLast()
      throw error
    }
    const events = this.playmodes.length + this.scores.length
    this.applyExtras(cycle, extras, frame)
    const f = this.store.columns
    f.cycle[frame] = cycle
    f.playmode[frame] = this.mode
    f.scoreLeft[frame] = this.score?.left ?? 0
    f.scoreRight[frame] = this.score?.right ?? 0
    if (this.playmodes.length + this.scores.length === events) this.collapse(frame)
  }

  private applyExtras(cycle: number, extras: ShowExtras, frame: number): void {
    if (extras.mode !== null && extras.mode !== this.mode) this.setMode(cycle, extras.mode, frame)
    if (extras.team !== null) this.setTeam(cycle, extras.team, true)
  }

  /**
   * While the clock is stopped before the kick-off or after the end, the server steps and sends
   * the same cycle ten times a second (`src/stadium.cpp:815-821`). A monitor keeps one frame
   * for it, so a session left waiting does not fill the frame limit.
   */
  private collapse(frame: number): void {
    const f = this.store.columns
    const previous = frame - 1
    if (this.source !== 'monitor' || previous < 0) return
    if (this.mode !== BEFORE_KICK_OFF && this.mode !== TIME_OVER) return
    if (f.cycle[previous] !== f.cycle[frame] || f.playmode[previous] !== this.mode) return
    this.store.copyFrame(frame, previous)
    this.store.dropLast()
    this.dirtyFrom = Math.min(this.dirtyFrom, previous)
  }

  private setMode(cycle: number, mode: number, frame: number): void {
    this.mode = mode
    if (this.playmodes.length >= this.limits.maxEvents) {
      this.skippedLines++
      return
    }
    this.playmodes.push({ frame, cycle, mode })
  }

  private playmode(s: Scanner): void {
    const cycle = s.int(0, MAX_CYCLE)
    const mode = playModeId(s.token())
    if (mode === undefined) {
      this.skippedLines++
      return
    }
    this.setMode(cycle, mode, this.store.count)
  }

  private team(s: Scanner): void {
    const cycle = s.int(0, MAX_CYCLE)
    this.setTeam(cycle, readTeam(s), false)
  }

  /**
   * Records a team line. From inside a show it is the frame being read and only a change is
   * kept, since every monitor show repeats it.
   */
  private setTeam(cycle: number, line: TeamLine, inShow: boolean): void {
    this.leftName = line.leftName || this.leftName
    this.rightName = line.rightName || this.rightName
    const change = scoreChange(this.store.count - (inShow ? 1 : 0), cycle, line.scores)
    if (inShow && this.score !== null && sameScore(this.score, change)) return
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
        this.graphicsChanged = true
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

  /** Frames read so far. */
  get frameCount(): number {
    return this.store.count
  }

  /** Hands over what arrived since the last call, or null when nothing did. */
  drain(): MatchDelta | null {
    const { sent } = this
    const count = this.store.count
    const from = Math.min(sent.frames, this.dirtyFrom, count)
    const changed =
      from < count ||
      this.playmodes.length > sent.playmodes ||
      this.scores.length > sent.scores ||
      this.messages.length > sent.messages ||
      this.graphicsChanged ||
      this.paramsChanged
    if (!changed) return null
    const delta: MatchDelta = {
      from,
      frames: this.store.slice(from),
      leftName: this.leftName,
      rightName: this.rightName,
      playmodes: this.playmodes.slice(sent.playmodes),
      scores: this.scores.slice(sent.scores),
      messages: this.messages.slice(sent.messages),
      graphics: this.graphicsChanged ? this.graphicsList() : null,
      params: this.paramsChanged
        ? {
            serverParams: this.serverParams,
            playerParams: this.playerParams,
            playerTypes: [...this.playerTypes],
          }
        : null,
      skippedLines: this.skippedLines,
    }
    this.sent.frames = count
    this.sent.playmodes = this.playmodes.length
    this.sent.scores = this.scores.length
    this.sent.messages = this.messages.length
    this.dirtyFrom = count
    this.graphicsChanged = false
    this.paramsChanged = false
    return delta
  }

  private graphicsList(): Match['graphics'] {
    return { l: [...this.graphics.l.values()], r: [...this.graphics.r.values()] }
  }

  /** Closes the log and returns the match. Fails if no frame was read. */
  finish(): Match {
    if (this.version === 0) throw new RcgError('O arquivo está vazio.')
    if (this.store.count === 0) throw new RcgError('O log não tem nenhum quadro (show).')
    const last = this.store.count - 1
    const clamp = clampTo(last)
    return {
      version: this.version,
      leftName: this.leftName,
      rightName: this.rightName,
      frames: this.store.finish(),
      playmodes: this.playmodes.map(clamp),
      scores: this.scores.map(clamp),
      messages: this.messages.map(clamp),
      graphics: this.graphicsList(),
      serverParams: this.serverParams,
      playerParams: this.playerParams,
      playerTypes: this.playerTypes,
      skippedLines: this.skippedLines,
    }
  }
}

function scoreChange(frame: number, cycle: number, scores: number[]): ScoreChange {
  const [left = 0, right = 0, penLeft = 0, missLeft = 0, penRight = 0, missRight = 0] = scores
  return {
    frame,
    cycle,
    left,
    right,
    penaltiesLeft: penLeft,
    penaltiesRight: penRight,
    penaltyMissesLeft: missLeft,
    penaltyMissesRight: missRight,
  }
}

function sameScore(a: ScoreChange, b: ScoreChange): boolean {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.penaltiesLeft === b.penaltiesLeft &&
    a.penaltiesRight === b.penaltiesRight &&
    a.penaltyMissesLeft === b.penaltyMissesLeft &&
    a.penaltyMissesRight === b.penaltyMissesRight
  )
}

/** Pulls an entry that points past the last frame back onto it. */
export function clampTo(last: number): <T extends { frame: number }>(entry: T) => T {
  return (entry) => ({ ...entry, frame: Math.min(entry.frame, last) })
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
