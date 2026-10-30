import { afterEach, describe, expect, test } from 'bun:test'

import { renderHook } from '@testing-library/react'

import { BOOTING_CLASS, useBooted } from './booted'

afterEach(() => document.documentElement.classList.remove(BOOTING_CLASS))

describe('useBooted', () => {
  test('shows the page by dropping the booting class once mounted', () => {
    document.documentElement.classList.add(BOOTING_CLASS)
    renderHook(() => useBooted())
    expect(document.documentElement).not.toHaveClass(BOOTING_CLASS)
  })

  test('leaves the other classes of the page alone', () => {
    document.documentElement.classList.add(BOOTING_CLASS, 'dark')
    renderHook(() => useBooted())
    expect(document.documentElement).toHaveClass('dark')
    document.documentElement.classList.remove('dark')
  })
})
