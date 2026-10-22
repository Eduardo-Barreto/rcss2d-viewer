import { describe, expect, test } from 'bun:test'

import { subjectErrors, subjectOf } from './commit-msg.ts'

describe('subject of a commit message', () => {
  test('takes the first line and skips git comments', () => {
    expect(subjectOf('# Please enter the message\nfix(relay): close on error\n\nbody\n')).toBe(
      'fix(relay): close on error',
    )
  })

  test('is empty for a message made only of comments', () => {
    expect(subjectOf('# nothing here\n')).toBe('')
  })
})

describe('subject errors', () => {
  test('accepts a typed subject with and without scope', () => {
    expect(subjectErrors('feat(replay): add a speed control')).toEqual([])
    expect(subjectErrors('docs: explain the relay')).toEqual([])
    expect(subjectErrors('feat(rcg/live)!: drop protocol 3')).toEqual([])
  })

  test('accepts subjects git writes itself', () => {
    expect(subjectErrors("Merge branch 'main' into feat/x")).toEqual([])
    expect(subjectErrors('fixup! fix(relay): close on error')).toEqual([])
  })

  test('rejects an unknown type and a missing colon', () => {
    expect(subjectErrors('feature: add a thing')).toHaveLength(1)
    expect(subjectErrors('fix the relay')).toHaveLength(1)
  })

  test('rejects an empty subject', () => {
    expect(subjectErrors('')).toHaveLength(1)
  })

  test('rejects accents and emoji', () => {
    expect(subjectErrors('docs: explica a relação')).toEqual([
      'must be plain ASCII: no emoji, no accents',
    ])
  })

  test('rejects a subject over 72 characters and a trailing period', () => {
    expect(subjectErrors(`docs: ${'a'.repeat(67)}`)).toEqual(['has 73 characters, the limit is 72'])
    expect(subjectErrors(`docs: ${'a'.repeat(66)}`)).toEqual([])
    expect(subjectErrors('docs: explain the relay.')).toEqual(['must not end with a period'])
  })
})
