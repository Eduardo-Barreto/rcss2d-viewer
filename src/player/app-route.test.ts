import { describe, expect, test } from 'bun:test'

import { forwardsToApp } from './app-route'

describe('forwardsToApp', () => {
  test('forwards an old link to a log and a cycle', () => {
    expect(forwardsToApp('?url=https%3A%2F%2Fx.dev%2Fa.rcg', 't=120')).toBe(true)
  })

  test('forwards a live link', () => {
    expect(forwardsToApp('?live=ws%3A%2F%2F127.0.0.1%3A6100', '')).toBe(true)
  })

  test('forwards a bare cycle', () => {
    expect(forwardsToApp('', '#t=40')).toBe(true)
  })

  test('keeps the plain root on the landing page', () => {
    expect(forwardsToApp('', '')).toBe(false)
    expect(forwardsToApp('?', '#')).toBe(false)
  })

  test('keeps section anchors and tracking parameters on the landing page', () => {
    expect(forwardsToApp('', 'comparacao')).toBe(false)
    expect(forwardsToApp('', '#lances')).toBe(false)
    expect(forwardsToApp('?utm_source=forum', '')).toBe(false)
    expect(forwardsToApp('?fbclid=abc', '#numeros')).toBe(false)
  })
})
