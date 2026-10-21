import { describe, expect, test } from 'bun:test'

import { analyzeMatch } from '@/analysis/analyze'
import { parseRcgText } from '@/rcg/parser'
import { PlayerState } from '@/rcg/types'
import { rcgText, showLine } from '@/test/rcg-builder'

import { type Viewport, fitCamera, toScreen } from './camera'
import type { Palette } from './palette'
import { type Overlays, type SceneInput, drawScene, slotAt } from './scene'
import { drawTimeline, ownerOfRange } from './timeline'

const VIEWPORT: Viewport = {
  width: 1130,
  height: 760,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
}
const OVERLAYS: Overlays = {
  trails: true,
  cones: true,
  offside: true,
  heatmap: true,
  stamina: true,
}
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

const match = parseRcgText(
  rcgText(
    showLine(
      1,
      [0, 0, 0, 0],
      [
        { side: 'l', unum: 1, x: -50, y: 0, state: PlayerState.STAND | PlayerState.GOALIE },
        { side: 'l', unum: 9, x: 10, y: 5, state: PlayerState.STAND | PlayerState.KICK },
        { side: 'r', unum: 4, x: 10.6, y: 5, state: PlayerState.STAND | PlayerState.YELLOW_CARD },
      ],
    ),
  ),
)

function sceneInput(): SceneInput {
  return {
    match,
    analysis: analyzeMatch(match),
    frame: 0,
    camera: fitCamera(VIEWPORT),
    viewport: VIEWPORT,
    dpr: 2,
    palette: PALETTE,
    overlays: OVERLAYS,
    selected: 8,
    hovered: 14,
    heatmap: { cols: 2, rows: 2, cells: new Float32Array([1, 0, 0, 3]), peak: 3 },
  }
}

function recorder() {
  const calls: string[] = []
  const ctx = new Proxy(
    {},
    {
      get:
        (_, name: string) =>
        (...args: unknown[]) => {
          calls.push(name)
          return args
        },
      set: () => true,
    },
  )
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the recorder answers every method
  return { ctx: ctx as CanvasRenderingContext2D, calls }
}

describe('scene', () => {
  test('paints every layer without throwing', () => {
    const { ctx, calls } = recorder()
    drawScene(ctx, sceneInput())
    expect(calls).toContain('fillRect')
    expect(calls.filter((name) => name === 'fillText')).toHaveLength(3)
  })

  test('picks the nearest player under the pointer', () => {
    const input = sceneInput()
    const at = toScreen(input.camera, input.viewport, { x: 10.5, y: 5 })
    expect(slotAt(input, at)).toBe(14)
    const goalie = toScreen(input.camera, input.viewport, { x: -50, y: 0 })
    expect(slotAt(input, goalie)).toBe(0)
    expect(slotAt(input, { x: 0, y: 0 })).toBe(-1)
  })
})

describe('timeline', () => {
  test('colors a range by the side that owned the ball most', () => {
    const owner = new Int8Array([0, 1, 1, -1])
    const live = parseRcgText(
      rcgText(
        '(playmode 0 play_on)',
        ...[1, 2, 3, 4].map((cycle) => showLine(cycle, [0, 0, 0, 0], [])),
      ),
    )
    expect(ownerOfRange(live, owner, 0, 3)).toBe(1)
    expect(ownerOfRange(live, owner, 0, 1)).toBe(0)
    expect(ownerOfRange(live, owner, 3, 4)).toBe(-1)
  })

  test('paints the strip and every mark', () => {
    const { ctx, calls } = recorder()
    drawTimeline(ctx, {
      match,
      analysis: analyzeMatch(match),
      marks: [
        { frame: 0, kind: 'goal', side: 'l', strong: true },
        { frame: 0, kind: 'shot', side: 'r', strong: false },
        { frame: 0, kind: 'card', side: 'r', strong: true },
      ],
      halves: [0],
      width: 40,
      height: 24,
      dpr: 1,
      palette: PALETTE,
    })
    expect(calls.filter((name) => name === 'arc')).toHaveLength(1)
    expect(calls.filter((name) => name === 'fillRect').length).toBeGreaterThan(40)
  })

  test('marks a half end with a short tick, not a full-height line', () => {
    const rects: { style: string; height: number }[] = []
    const state = { fillStyle: '' }
    const ctx = new Proxy(state, {
      get: (target, name: string) =>
        name === 'fillRect'
          ? (_x: number, _y: number, _w: number, h: number) =>
              rects.push({ style: target.fillStyle, height: h })
          : () => undefined,
    })
    drawTimeline(
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the stub answers every method
      ctx as unknown as CanvasRenderingContext2D,
      {
        match,
        analysis: analyzeMatch(match),
        marks: [],
        halves: [0],
        width: 40,
        height: 24,
        dpr: 1,
        palette: PALETTE,
      },
    )
    const ticks = rects.filter((rect) => rect.style === PALETTE.muted)
    expect(ticks).toHaveLength(1)
    expect(ticks[0]?.height).toBe(6)
  })
})
