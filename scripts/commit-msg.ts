#!/usr/bin/env bun
/**
 * Checks that a commit subject or a pull request title follows Conventional Commits:
 *
 *   bun scripts/commit-msg.ts <message-file>     (lefthook `commit-msg`)
 *   bun scripts/commit-msg.ts --title "<title>"  (CI, on the pull request title)
 *
 * The subject is `type(scope)!: description` in plain ASCII, at most 72 characters, with no
 * trailing period. Subjects that git writes itself (merge, revert, fixup, squash, amend) pass.
 */

import { readFileSync } from 'node:fs'

const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
]
const SUBJECT = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9._/-]+\\))?!?: \\S.*$`)
const GIT_WRITTEN = ['Merge ', 'Revert "', 'fixup! ', 'squash! ', 'amend! ']
const MAX_LENGTH = 72
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

/** First line of a commit message, skipping the `#` comments git adds to the editor buffer. */
export function subjectOf(message: string): string {
  const lines = message.split('\n').filter((line) => !line.startsWith('#'))
  return lines.join('\n').trim().split('\n')[0] ?? ''
}

/** Reasons `subject` breaks the convention. An empty list means it passes. */
export function subjectErrors(subject: string): string[] {
  if (GIT_WRITTEN.some((prefix) => subject.startsWith(prefix))) return []
  const errors: string[] = []
  if (!SUBJECT.test(subject)) {
    errors.push(`must be \`type(scope): description\`, with type one of ${TYPES.join(', ')}`)
  }
  if (!PRINTABLE_ASCII.test(subject)) errors.push('must be plain ASCII: no emoji, no accents')
  if (subject.length > MAX_LENGTH) {
    errors.push(`has ${String(subject.length)} characters, the limit is ${String(MAX_LENGTH)}`)
  }
  if (subject.endsWith('.')) errors.push('must not end with a period')
  return errors
}

if (import.meta.main) {
  const [flag, value] = process.argv.slice(2)
  if (flag === undefined || (flag === '--title' && value === undefined)) {
    console.error('usage: bun scripts/commit-msg.ts <message-file> | --title "<title>"')
    process.exit(2)
  }
  const subject = flag === '--title' ? (value ?? '') : subjectOf(readFileSync(flag, 'utf8'))
  const errors = subjectErrors(subject)
  if (errors.length > 0) {
    console.error(`rejected: ${subject}`)
    for (const error of errors) console.error(`  - ${error}`)
    console.error('  example: feat(replay): add a speed control')
    process.exit(1)
  }
}
