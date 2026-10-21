import { describe, expect, test } from 'bun:test'

import { RcgError } from './scanner'
import { checkLogUrl, sourceName } from './source'

describe('checkLogUrl', () => {
  test('accepts https only', () => {
    expect(checkLogUrl('https://example.com/a.rcg.gz').hostname).toBe('example.com')
    for (const raw of ['http://example.com/a.rcg', 'file:///etc/passwd', 'javascript:alert(1)']) {
      expect(() => checkLogUrl(raw)).toThrow(RcgError)
    }
  })

  test('refuses credentials and garbage', () => {
    expect(() => checkLogUrl('https://user:pw@example.com/a.rcg')).toThrow(RcgError)
    expect(() => checkLogUrl('not a url')).toThrow(RcgError)
  })
})

describe('sourceName', () => {
  test('uses the last path segment, decoded', () => {
    expect(sourceName({ kind: 'url', url: 'https://x.dev/logs/jogo%201.rcg.gz' })).toBe(
      'jogo 1.rcg.gz',
    )
    expect(sourceName({ kind: 'url', url: 'https://x.dev/' })).toBe('https://x.dev/')
  })

  test('never throws on a bad address', () => {
    expect(sourceName({ kind: 'url', url: 'nope' })).toBe('nope')
    expect(sourceName({ kind: 'url', url: 'https://x.dev/%E0%A4%A' })).toBe(
      'https://x.dev/%E0%A4%A',
    )
  })
})
