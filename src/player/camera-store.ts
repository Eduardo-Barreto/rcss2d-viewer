import { create } from 'zustand'

import {
  type Camera,
  type Point,
  type Viewport,
  centerOn,
  fitCamera,
  panBy,
  zoomAt,
} from '@/render/camera'

/** Zoom factor of one press of `+` or `-`. */
export const ZOOM_STEP = 1.25

const EMPTY_VIEWPORT: Viewport = {
  width: 1,
  height: 1,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
}

/** The canvas camera, shared by the pitch and the zoom controls. */
export interface CameraState {
  viewport: Viewport
  camera: Camera
  /** Set once the person zooms or pans, so a resize keeps their view instead of refitting. */
  moved: boolean
  setViewport: (viewport: Viewport) => void
  zoomBy: (factor: number, anchor?: Point) => void
  pan: (dx: number, dy: number, from?: Camera) => void
  centerOn: (world: Point) => void
  refit: () => void
}

function middle(viewport: Viewport): Point {
  const { width, height, insets } = viewport
  return {
    x: (insets.left + width - insets.right) / 2,
    y: (insets.top + height - insets.bottom) / 2,
  }
}

function sameOrientation(a: Camera, b: Camera): boolean {
  return a.upright === b.upright
}

/** Camera store. A resize refits unless the view was moved and kept its orientation. */
export const useCamera = create<CameraState>()((set, get) => ({
  viewport: EMPTY_VIEWPORT,
  camera: fitCamera(EMPTY_VIEWPORT),
  moved: false,

  setViewport(viewport) {
    const { camera, moved } = get()
    const fit = fitCamera(viewport)
    if (moved && sameOrientation(camera, fit)) {
      const ratio = camera.scale / camera.fitScale
      set({ viewport, camera: { ...camera, fitScale: fit.scale, scale: fit.scale * ratio } })
      return
    }
    set({ viewport, camera: fit, moved: false })
  },

  zoomBy(factor, anchor) {
    const { camera, viewport } = get()
    set({ camera: zoomAt(camera, viewport, factor, anchor ?? middle(viewport)), moved: true })
  },

  pan(dx, dy, from) {
    set({ camera: panBy(from ?? get().camera, dx, dy), moved: true })
  },

  centerOn(world) {
    set({ camera: centerOn(get().camera, world) })
  },

  refit() {
    set({ camera: fitCamera(get().viewport), moved: false })
  },
}))
