import { describe, expect, test } from 'bun:test'

import { type KeyPress, keyAction } from './keys'

function press(key: string, extra: Partial<KeyPress> = {}): KeyPress {
  return { key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra }
}

describe('keyAction', () => {
  test('maps plain keys, ignoring case', () => {
    expect(keyAction(press(' '))).toBe('play')
    expect(keyAction(press('K'))).toBe('play')
    expect(keyAction(press('ArrowRight'))).toBe('forward')
    expect(keyAction(press('?', { shiftKey: true }))).toBe('help')
  })

  test('shift changes arrows and moments', () => {
    expect(keyAction(press('ArrowLeft', { shiftKey: true }))).toBe('backLong')
    expect(keyAction(press('E', { shiftKey: true }))).toBe('previousMoment')
    expect(keyAction(press('e'))).toBe('nextMoment')
  })

  test('leaves browser shortcuts alone', () => {
    expect(keyAction(press('f', { ctrlKey: true }))).toBeNull()
    expect(keyAction(press('0', { metaKey: true }))).toBeNull()
    expect(keyAction(press('x'))).toBeNull()
  })
})
