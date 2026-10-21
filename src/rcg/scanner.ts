/** A log the viewer refuses to read, with a message meant for the person who opened it. */
export class RcgError extends Error {
  override name = 'RcgError'
}

/** A line that does not follow the format, as opposed to a log that passes a limit. */
export class RcgSyntaxError extends RcgError {
  override name = 'RcgSyntaxError'
}

const SPACE = 32
const TAB = 9
const CARRIAGE_RETURN = 13
const OPEN = 40
const CLOSE = 41
const QUOTE = 34
const SNIPPET_LENGTH = 20

/** Character codes the parsers compare against. */
export const Char = { OPEN, CLOSE, QUOTE } as const

/**
 * Cursor over one line of an s-expression log. Hand-rolled instead of a generic s-expression
 * tree because a full match is tens of megabytes of `(show ...)` lines, and building a tree
 * per line would allocate several times the file size.
 */
export class Scanner {
  pos = 0
  readonly text: string
  readonly line: number

  constructor(text: string, line: number) {
    this.text = text
    this.line = line
  }

  /** Throws an {@link RcgError} that names the line. */
  fail(what: string): never {
    throw new RcgSyntaxError(`Linha ${this.line}: ${what}`)
  }

  /** Skips spaces and returns the next character code, or -1 at the end of the line. */
  peek(): number {
    const { text } = this
    let { pos } = this
    while (pos < text.length) {
      const code = text.charCodeAt(pos)
      if (code !== SPACE && code !== TAB && code !== CARRIAGE_RETURN) break
      pos++
    }
    this.pos = pos
    return pos < text.length ? text.charCodeAt(pos) : -1
  }

  /** True when the next non-space text is `prefix`. */
  startsWith(prefix: string): boolean {
    this.peek()
    return this.text.startsWith(prefix, this.pos)
  }

  /** Consumes one expected character. */
  expect(code: number): void {
    if (this.peek() !== code) this.fail(`esperava "${String.fromCharCode(code)}"`)
    this.pos++
  }

  /** Reads a bare token up to the next space or parenthesis. */
  token(): string {
    this.peek()
    const { text } = this
    const start = this.pos
    let { pos } = this
    while (pos < text.length) {
      const code = text.charCodeAt(pos)
      if (code === SPACE || code === OPEN || code === CLOSE || code === TAB) break
      pos++
    }
    if (pos === start) this.fail('esperava um valor')
    this.pos = pos
    return text.slice(start, pos)
  }

  /** Reads a finite number. `Number` also takes the `0x` state field. */
  number(): number {
    const token = this.token()
    const value = Number(token)
    if (!Number.isFinite(value)) this.fail(`número inválido "${token.slice(0, SNIPPET_LENGTH)}"`)
    return value
  }

  /** Reads an integer inside `[min, max]`. */
  int(min: number, max: number): number {
    const value = this.number()
    if (!Number.isInteger(value) || value < min || value > max) {
      this.fail(`inteiro fora do intervalo ${min}..${max}`)
    }
    return value
  }

  /** Reads a double-quoted string with no escapes, which is how the server writes them. */
  quoted(): string {
    this.expect(QUOTE)
    const end = this.text.indexOf('"', this.pos)
    if (end === -1) this.fail('texto sem aspas de fechamento')
    const value = this.text.slice(this.pos, end)
    this.pos = end + 1
    return value
  }

  /** Skips a balanced group whose opening parenthesis was already consumed. */
  skipGroup(): void {
    let depth = 1
    const { text } = this
    let { pos } = this
    while (pos < text.length && depth > 0) {
      const code = text.charCodeAt(pos)
      if (code === OPEN) depth++
      else if (code === CLOSE) depth--
      pos++
    }
    if (depth > 0) this.fail('parênteses desbalanceados')
    this.pos = pos
  }
}
