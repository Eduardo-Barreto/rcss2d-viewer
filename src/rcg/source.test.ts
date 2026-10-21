import { afterEach, describe, expect, test } from 'bun:test'

import { RcgError } from './scanner'
import { checkLiveUrl, checkLogUrl, openSource, sourceName } from './source'

const realFetch = globalThis.fetch

function serve(body: Uint8Array, headers: Record<string, string>): void {
  const reply = () => Promise.resolve(new Response(new Blob([new Uint8Array(body)]), { headers }))
  globalThis.fetch = Object.assign(reply, { preconnect: realFetch.preconnect })
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<number> {
  let total = 0
  for await (const chunk of stream) total += chunk.byteLength
  return total
}

async function failure(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending
  } catch (error) {
    return error
  }
  return null
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('checkLiveUrl', () => {
  test.each([
    'ws://127.0.0.1:6100',
    'ws://localhost:6100',
    'ws://[::1]:6100',
    'wss://relay.example.com/live',
  ])('accepts %s', (raw) => {
    expect(checkLiveUrl(raw).href).toStartWith(raw)
  })

  test.each([
    'ws://192.168.0.10:6100',
    'ws://relay.example.com',
    'ws://127.0.0.1.example.com:6100',
    'http://127.0.0.1:6100',
    'https://relay.example.com',
    'wss://user:pw@relay.example.com',
    'ws://user@127.0.0.1:6100',
    'wss://relay.example.com/#x',
    'javascript:alert(1)',
    'not a url',
  ])('refuses %s', (raw) => {
    expect(() => checkLiveUrl(raw)).toThrow(RcgError)
  })
})

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

  test('drops bidi and other format characters', () => {
    expect(sourceName({ kind: 'file', file: new Blob(), name: 'jogo\u202Egpj.rcg' })).toBe(
      'jogogpj.rcg',
    )
    expect(sourceName({ kind: 'url', url: 'https://x.dev/a%E2%80%8Bb.rcg' })).toBe('ab.rcg')
  })

  test('never throws on a bad address', () => {
    expect(sourceName({ kind: 'url', url: 'nope' })).toBe('nope')
    expect(sourceName({ kind: 'url', url: 'https://x.dev/%E0%A4%A' })).toBe(
      'https://x.dev/%E0%A4%A',
    )
  })
})

describe('openSource', () => {
  const url = { kind: 'url', url: 'https://x.dev/a.rcg' } as const

  test('refuses up front when the length says it is too big', async () => {
    serve(new Uint8Array(10), { 'content-length': '10' })
    expect(await failure(openSource(url, undefined, 4))).toBeInstanceOf(RcgError)
  })

  test('stops a body with no length once it passes the limit', async () => {
    serve(new Uint8Array(10), {})
    const { stream, size } = await openSource(url, undefined, 4)
    expect(size).toBeNull()
    expect(String(await failure(drain(stream)))).toMatch(/256 MB/)
  })

  test('reads a body within the limit', async () => {
    serve(new Uint8Array(10), { 'content-length': '10' })
    const { stream, size } = await openSource(url, undefined, 64)
    expect(size).toBe(10)
    expect(await drain(stream)).toBe(10)
  })

  test('does not trust the length of an encoded body for progress', async () => {
    serve(new Uint8Array(10), { 'content-length': '3', 'content-encoding': 'gzip' })
    expect((await openSource(url, undefined, 64)).size).toBeNull()
  })
})
