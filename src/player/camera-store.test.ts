import { beforeEach, describe, expect, test } from 'bun:test'

import { ZOOM_STEP, useCamera } from './camera-store'

const WIDE = { width: 1130, height: 760, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
const TALL = { width: 400, height: 800, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
const camera = () => useCamera.getState()

beforeEach(() => {
  camera().setViewport(WIDE)
  camera().refit()
})

describe('camera store', () => {
  test('keeps the zoom ratio across a resize once moved', () => {
    camera().zoomBy(ZOOM_STEP)
    camera().setViewport({ ...WIDE, width: 2260, height: 1520 })
    const { scale, fitScale } = camera().camera
    expect(scale / fitScale).toBeCloseTo(ZOOM_STEP)
  })

  test('refits when the screen turns', () => {
    camera().zoomBy(ZOOM_STEP)
    camera().setViewport(TALL)
    expect(camera()).toMatchObject({ moved: false, camera: { upright: true } })
  })

  test('pans from a starting camera', () => {
    const start = camera().camera
    camera().pan(100, 0, start)
    camera().pan(100, 0, start)
    expect(camera().camera.x).toBeCloseTo(start.x - 100 / start.scale)
  })
})
