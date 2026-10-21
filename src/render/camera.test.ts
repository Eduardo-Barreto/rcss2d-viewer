import { describe, expect, test } from 'bun:test'

import {
  type Viewport,
  fitCamera,
  panBy,
  toScreen,
  toWorld,
  worldTransform,
  zoomAt,
} from './camera'

const WIDE: Viewport = {
  width: 1150,
  height: 780,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
}
const TALL: Viewport = {
  width: 400,
  height: 800,
  insets: { top: 60, right: 0, bottom: 140, left: 0 },
}

describe('camera', () => {
  test('fits the pitch with its margin and centers it in the free area', () => {
    const camera = fitCamera(WIDE)
    expect(camera.upright).toBe(false)
    expect(camera.scale).toBeCloseTo(10)
    expect(toScreen(camera, WIDE, { x: 0, y: 0 })).toEqual({ x: 575, y: 390 })
    expect(toScreen(camera, WIDE, { x: 52.5, y: 34 })).toEqual({ x: 1100, y: 730 })
  })

  test('stands the pitch upright on a portrait screen with the left goal at the bottom', () => {
    const camera = fitCamera(TALL)
    expect(camera.upright).toBe(true)
    const leftGoal = toScreen(camera, TALL, { x: -52.5, y: 0 })
    const rightGoal = toScreen(camera, TALL, { x: 52.5, y: 0 })
    expect(leftGoal.y).toBeGreaterThan(rightGoal.y)
    expect(leftGoal.x).toBeCloseTo(200)
  })

  test('screen and world round-trip in both orientations', () => {
    for (const viewport of [WIDE, TALL]) {
      const camera = { ...fitCamera(viewport), x: 3, y: -2, scale: 17 }
      const back = toWorld(camera, viewport, toScreen(camera, viewport, { x: 12, y: -7 }))
      expect(back.x).toBeCloseTo(12)
      expect(back.y).toBeCloseTo(-7)
    }
  })

  test('zoom keeps the anchor still and stays within limits', () => {
    const camera = fitCamera(WIDE)
    const anchor = { x: 900, y: 200 }
    const before = toWorld(camera, WIDE, anchor)
    const zoomed = zoomAt(camera, WIDE, 3, anchor)
    const after = toWorld(zoomed, WIDE, anchor)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(zoomAt(camera, WIDE, 1000, anchor).scale).toBe(camera.fitScale * 16)
  })

  test('a drag moves the world with the pointer', () => {
    for (const viewport of [WIDE, TALL]) {
      const camera = fitCamera(viewport)
      const grab = toWorld(camera, viewport, { x: 100, y: 300 })
      const moved = panBy(camera, 40, -25)
      const now = toScreen(moved, viewport, grab)
      expect(now.x).toBeCloseTo(140)
      expect(now.y).toBeCloseTo(275)
    }
  })

  test('the context transform agrees with toScreen', () => {
    for (const viewport of [WIDE, TALL]) {
      const camera = { ...fitCamera(viewport), x: 5, y: 1 }
      const m = worldTransform(camera, viewport, 2)
      const world = { x: 20, y: -9 }
      const screen = toScreen(camera, viewport, world)
      expect(((m.a ?? 0) * world.x + (m.c ?? 0) * world.y + (m.e ?? 0)) / 2).toBeCloseTo(screen.x)
      expect(((m.b ?? 0) * world.x + (m.d ?? 0) * world.y + (m.f ?? 0)) / 2).toBeCloseTo(screen.y)
    }
  })
})
