import { describe, expect, test } from 'bun:test'

import { ALLOWED_COMMANDS, RateLimit, checkCommand, isAllowedOrigin, isLoopback } from './policy.ts'

describe('isAllowedOrigin', () => {
  test.each([
    'https://rcssviewer.tapout.gg',
    'https://rcssviewer.barreto.sh',
    'https://rcss2d-viewer.pages.dev',
    'https://feat-live.rcss2d-viewer.pages.dev',
    'https://3f2a91c0.rcss2d-viewer.pages.dev',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://rcss2d-viewer.localhost:1355',
    'http://localhost',
  ])('lets %s in', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true)
  })

  test.each([
    'https://evil.example',
    'http://rcssviewer.tapout.gg',
    'https://rcssviewer.tapout.gg.evil.example',
    'https://evil.rcssviewer.tapout.gg',
    'https://rcssviewer.tapout.gg:8443',
    'https://rcssviewer.tapout.gg/',
    'http://rcssviewer.barreto.sh',
    'https://rcssviewer.barreto.sh.evil.example',
    'https://evilrcss2d-viewer.pages.dev',
    'https://a.b.rcss2d-viewer.pages.dev',
    'https://feat-live.rcss2d-viewer.pages.dev:8443',
    'http://feat-live.rcss2d-viewer.pages.dev',
    'https://localhost:5173',
    'http://192.168.0.10:5173',
    'http://localhost.evil.example',
    'http://localhost:5173/path',
    'null',
    '',
    'file://',
  ])('refuses %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false)
  })

  test('a missing Origin only with allowMissing', () => {
    expect(isAllowedOrigin(null)).toBe(false)
    expect(isAllowedOrigin(null, true)).toBe(true)
  })
})

describe('isLoopback', () => {
  test.each(['127.0.0.1', '127.1.2.3', 'localhost', '::1', '[::1]'])('%s is loopback', (host) => {
    expect(isLoopback(host)).toBe(true)
  })

  test.each(['0.0.0.0', '192.168.0.1', '::', 'example.com', '127.0.0.1.evil'])(
    '%s is not',
    (host) => {
      expect(isLoopback(host)).toBe(false)
    },
  )
})

describe('checkCommand', () => {
  test('only the two monitor commands, matched whole', () => {
    expect([...ALLOWED_COMMANDS]).toEqual(['(dispstart)', '(dispbye)'])
    for (const text of [
      '(dispstart) ',
      '(dispstart)x',
      '(dispbye)\0',
      '(dispinit version 5)',
      '(dispfoul_left 0 0)',
      '(dispdiscard 1)',
      '(dispplayer 1 0 0 0)',
      '(compression 1)',
      '',
    ]) {
      expect(checkCommand(text, true, new RateLimit(4, 1000, 0), 0)).toBe('not-allowed')
    }
  })

  test('(dispstart) only while waiting for the kick-off', () => {
    expect(checkCommand('(dispstart)', true, new RateLimit(4, 1000, 0), 0)).toBeNull()
    expect(checkCommand('(dispstart)', false, new RateLimit(4, 1000, 0), 0)).toBe('not-waiting')
    expect(checkCommand('(dispbye)', false, new RateLimit(4, 1000, 0), 0)).toBeNull()
  })

  test('a burst, then one per refill', () => {
    const limit = new RateLimit(2, 1000, 0)
    expect(checkCommand('(dispbye)', true, limit, 0)).toBeNull()
    expect(checkCommand('(dispbye)', true, limit, 0)).toBeNull()
    expect(checkCommand('(dispbye)', true, limit, 10)).toBe('rate')
    expect(checkCommand('(dispbye)', true, limit, 1010)).toBeNull()
    expect(checkCommand('(dispbye)', true, limit, 1020)).toBe('rate')
  })
})
