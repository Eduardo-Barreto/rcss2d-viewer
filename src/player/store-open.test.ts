import { describe, expect, mock, test } from 'bun:test'

import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

const match = parseRcgText(
  rcgText(
    '(server_param (simulator_step 100))',
    showLine(1, [0, 0, 0, 0], [{ side: 'l', unum: 1, x: 0, y: 0 }]),
  ),
)

let signal: AbortSignal | null = null

await mock.module('@/rcg/load', () => ({
  loadMatch: (_source: unknown, _progress: unknown, given: AbortSignal) => {
    signal = given
    return Promise.resolve(match)
  },
}))

const { useReplay } = await import('./store')

describe('opening a log', () => {
  test('a read that finishes is not cut off by its own result', async () => {
    await useReplay.getState().open({ kind: 'file', file: new Blob([]), name: 'inteiro.rcg' })
    expect(useReplay.getState()).toMatchObject({ status: 'ready', name: 'inteiro.rcg', match })
    expect(signal?.aborted).toBe(false)
  })
})
