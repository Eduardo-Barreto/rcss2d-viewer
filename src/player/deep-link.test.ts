import { describe, expect, test } from 'bun:test'

import { addressOf, cycleHash, parseDeepLink } from './deep-link'

describe('deep links', () => {
  test('reads the log address and the cycle', () => {
    expect(parseDeepLink('?url=https%3A%2F%2Fx.dev%2Fa.rcg', '#t=1200')).toEqual({
      url: 'https://x.dev/a.rcg',
      live: null,
      cycle: 1200,
    })
  })

  test('ignores a missing or malformed part', () => {
    expect(parseDeepLink('', '')).toEqual({ url: null, live: null, cycle: null })
    expect(parseDeepLink('?url=&live=', '#t=abc')).toEqual({ url: null, live: null, cycle: null })
    expect(parseDeepLink('', '#t=-5')).toEqual({ url: null, live: null, cycle: null })
  })

  test('writes the cycle back', () => {
    expect(cycleHash(812.6)).toBe('#t=813')
  })

  test('rewrites the whole address for the open log', () => {
    expect(addressOf('/', { url: 'https://x.dev/a b.rcg', live: null }, null)).toBe(
      '/?url=https%3A%2F%2Fx.dev%2Fa+b.rcg',
    )
    expect(addressOf('/', { url: 'https://x.dev/a.rcg', live: null }, 40)).toBe(
      '/?url=https%3A%2F%2Fx.dev%2Fa.rcg#t=40',
    )
    expect(addressOf('/', { url: null, live: null }, null)).toBe('/')
    const { url } = parseDeepLink(
      addressOf('/', { url: 'https://x.dev/a b.rcg', live: null }, null).slice(1),
      '',
    )
    expect(url).toBe('https://x.dev/a b.rcg')
  })

  test('reads and writes a relay address', () => {
    expect(parseDeepLink('?live=ws%3A%2F%2F127.0.0.1%3A6100', '').live).toBe('ws://127.0.0.1:6100')
    const address = addressOf('/', { url: null, live: 'ws://127.0.0.1:6100' }, null)
    expect(address).toBe('/?live=ws%3A%2F%2F127.0.0.1%3A6100')
    expect(parseDeepLink(address.slice(1), '').live).toBe('ws://127.0.0.1:6100')
  })
})
