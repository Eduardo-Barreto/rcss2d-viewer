import { describe, expect, test } from 'bun:test'

import { UsageError, parseArgs } from './args.ts'

describe('parseArgs', () => {
  test('defaults to loopback on both sides', () => {
    expect(parseArgs([])).toEqual({
      server: { host: '127.0.0.1', port: 6000 },
      listen: { host: '127.0.0.1', port: 6100 },
      allowRemote: false,
      allowNoOrigin: false,
    })
  })

  test('reads both addresses and the flags', () => {
    const options = parseArgs([
      '--server',
      '172.18.0.2:6001',
      '--listen',
      '[::1]:7000',
      '--allow-no-origin',
    ])
    expect(options?.server).toEqual({ host: '172.18.0.2', port: 6001 })
    expect(options?.listen).toEqual({ host: '::1', port: 7000 })
    expect(options?.allowNoOrigin).toBe(true)
  })

  test('localhost as the server becomes an IP', () => {
    expect(parseArgs(['--server', 'localhost:6000'])?.server.host).toBe('127.0.0.1')
  })

  test('--help returns null', () => {
    expect(parseArgs(['--help'])).toBeNull()
  })

  test('listening off loopback needs --allow-remote', () => {
    expect(() => parseArgs(['--listen', '0.0.0.0:6100'])).toThrow(UsageError)
    expect(parseArgs(['--listen', '0.0.0.0:6100', '--allow-remote'])?.listen.host).toBe('0.0.0.0')
  })

  test.each([
    [['--server', 'rcssserver:6000']],
    [['--server', '127.0.0.1']],
    [['--server', '127.0.0.1:0']],
    [['--listen', '127.0.0.1:70000']],
    [['--port', '6000']],
    [['--server']],
  ])('refuses %p', (argv: string[]) => {
    expect(() => parseArgs(argv)).toThrow(UsageError)
  })
})
