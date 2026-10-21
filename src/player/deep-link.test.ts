import { describe, expect, test } from 'bun:test'

import { addressOf, cycleHash, parseDeepLink } from './deep-link'

describe('deep links', () => {
  test('reads the log address and the cycle', () => {
    expect(parseDeepLink('?url=https%3A%2F%2Fx.dev%2Fa.rcg', '#t=1200')).toEqual({
      url: 'https://x.dev/a.rcg',
      cycle: 1200,
    })
  })

  test('ignores a missing or malformed part', () => {
    expect(parseDeepLink('', '')).toEqual({ url: null, cycle: null })
    expect(parseDeepLink('?url=', '#t=abc')).toEqual({ url: null, cycle: null })
    expect(parseDeepLink('', '#t=-5')).toEqual({ url: null, cycle: null })
  })

  test('writes the cycle back', () => {
    expect(cycleHash(812.6)).toBe('#t=813')
  })

  test('rewrites the whole address for the open log', () => {
    expect(addressOf('/', 'https://x.dev/a b.rcg', null)).toBe(
      '/?url=https%3A%2F%2Fx.dev%2Fa+b.rcg',
    )
    expect(addressOf('/', 'https://x.dev/a.rcg', 40)).toBe('/?url=https%3A%2F%2Fx.dev%2Fa.rcg#t=40')
    expect(addressOf('/', null, null)).toBe('/')
    const { url } = parseDeepLink(addressOf('/', 'https://x.dev/a b.rcg', null).slice(1), '')
    expect(url).toBe('https://x.dev/a b.rcg')
  })
})
