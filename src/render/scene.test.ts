import { describe, expect, test } from 'bun:test'

import { analyzeMatch } from '@/analysis/analyze'
import { parseRcgText } from '@/rcg/parser'
import { PlayerState } from '@/rcg/types'
import { rcgText, showLine } from '@/test/rcg-builder'

import { type Viewport, fitCamera, toScreen } from './camera'
import type { Palette } from './palette'
import { type Overlays, type SceneInput, drawScene, slotAt } from './scene'

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
