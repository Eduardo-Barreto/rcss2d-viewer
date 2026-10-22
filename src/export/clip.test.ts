import { describe, expect, test } from 'bun:test'

import { analyzeMatch } from '@/analysis/analyze'
import { parseRcgText } from '@/rcg/parser'
import type { Palette } from '@/render/palette'
import { rcgText, showLine } from '@/test/rcg-builder'

import { CLIP_WIDTH, checkClip, clipRange, clipSize, defaultClip, drawClipFrame } from './clip'

const PALETTE: Palette = {
  background: '#fff',
  pitch: '#eee',
  line: '#ccc',
  teamL: '#00f',
  teamR: '#f80',
  inkL: '#fff',
  inkR: '#000',
  ball: '#111',
  ballRing: '#fff',
  foreground: '#000',
  muted: '#777',
  ring: '#09f',
  goal: '#0a0',
  shot: '#fa0',
  foul: '#f00',
  card: '#c00',
}

const CYCLES = [1, 2, 3, 4, 4, 4, 5, 6, 7, 8]

const match = parseRcgText(
  rcgText(
    '(team 1 Azul Laranja 2 1)',
    '(playmode 1 play_on)',
    ...CYCLES.map((cycle) =>
      showLine(cycle, [cycle, 0, 0, 0], [{ side: 'l', unum: 1, x: -50, y: 0 }]),
    ),
  ),
)

function texts(input: Parameters<typeof drawClipFrame>[1]): string[] {
  const drawn: string[] = []
  const ctx = new Proxy(
    {},
    {
      get: (_, name: string) => {
        if (name === 'measureText') return (text: string) => ({ width: text.length * 7 })
        return (...args: unknown[]) => {
          if (name === 'fillText' && typeof args[0] === 'string') drawn.push(args[0])
        }
      },
      set: () => true,
    },
  )
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the recorder answers every method
  drawClipFrame(ctx as CanvasRenderingContext2D, input)
  return drawn
}

describe('clipRange', () => {
  test('covers every frame of the cycles, repeated stoppage cycles included', () => {
    expect(match.frames.count).toBe(CYCLES.length)
    expect(clipRange(match, 3, 6)).toEqual({ from: 3, to: 6, start: 2, count: 6 })
  })

  test('snaps to the cycles the log has', () => {
    expect(clipRange(match, 0, 100)).toEqual({ from: 1, to: 8, start: 0, count: 10 })
  })

  test('refuses a reversed, empty or too long range with a message for people', () => {
    expect(() => clipRange(match, 6, 3)).toThrow('O ciclo final precisa vir depois do inicial.')
    expect(() => clipRange(match, 50, 60)).toThrow('A partida não tem ciclos entre 50 e 60.')
    expect(() => clipRange(match, 1, 8, 5)).toThrow('O trecho passa de 5 quadros.')
  })
})

describe('defaultClip', () => {
  test('starts before the cycle and stays inside the match', () => {
    expect(defaultClip(match, 5)).toEqual({ from: 1, to: 8 })
  })
})

describe('checkClip', () => {
  test('tells how many frames and seconds a range plays', () => {
    expect(checkClip(match, 100, '3', '6')).toEqual({ ok: true, frames: 6, seconds: 0.6 })
  })

  test('explains why a range cannot be clipped', () => {
    expect(checkClip(match, 100, '', '6')).toEqual({
      ok: false,
      reason: 'Diga o ciclo inicial e o final.',
    })
    expect(checkClip(match, 100, '6', '3')).toEqual({
      ok: false,
      reason: 'O ciclo final precisa vir depois do inicial.',
    })
    expect(checkClip(match, 100, '2.5', '6').ok).toBe(false)
  })
})

describe('clipSize', () => {
  test('fits the pitch and its margin under the strip', () => {
    const size = clipSize()
    expect(size.width).toBe(CLIP_WIDTH)
    expect(size.height).toBe(488 + 28)
    expect(size.viewport.insets.top).toBe(28)
  })

  test('keeps the width in a sane range', () => {
    expect(clipSize(10).width).toBe(320)
    expect(clipSize(99_999).width).toBe(1600)
  })
})

describe('drawClipFrame', () => {
  test('writes the cycle, clock, teams, score and play mode in the strip', () => {
    const drawn = texts({
      match,
      analysis: analyzeMatch(match),
      palette: PALETTE,
      size: clipSize(),
      frame: 3,
    })
    expect(drawn).toContain('ciclo 4 · 00:00')
    expect(drawn).toContain('Azul')
    expect(drawn).toContain('Laranja')
    expect(drawn).toContain('2 × 1')
    expect(drawn).toContain('Bola rolando')
  })
})
