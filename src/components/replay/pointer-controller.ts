import { useCamera } from '@/player/camera-store'
import { useReplay } from '@/player/store'
import type { Camera, Point } from '@/render/camera'
import { slotAt } from '@/render/scene'

const WHEEL_ZOOM = 0.0015
const CLICK_SLOP_PX = 4

interface Drag {
  id: number
  start: Point
  camera: Camera
  moved: boolean
}

/**
 * Mouse, pen and touch on the pitch: a click selects the player under it, a drag pans, the wheel
 * and a two-finger pinch zoom. Panning or zooming drops the follow so the view stays put.
 */
export class PointerController {
  private readonly element: HTMLCanvasElement
  private readonly camera: () => Camera
  private readonly onHover: (slot: number) => void
  private readonly pointers = new Map<number, Point>()
  private drag: Drag | null = null
  private pinch = 0
  private hovered = -1

  constructor(element: HTMLCanvasElement, camera: () => Camera, onHover: (slot: number) => void) {
    this.element = element
    this.camera = camera
    this.onHover = onHover
  }

  /** Listens on the canvas and returns the function that stops. */
  attach(): () => void {
    const { element } = this
    element.addEventListener('pointerdown', this.down)
    element.addEventListener('pointermove', this.move)
    element.addEventListener('pointerup', this.up)
    element.addEventListener('pointercancel', this.up)
    element.addEventListener('pointerleave', this.leave)
    element.addEventListener('wheel', this.wheel, { passive: false })
    return () => {
      element.removeEventListener('pointerdown', this.down)
      element.removeEventListener('pointermove', this.move)
      element.removeEventListener('pointerup', this.up)
      element.removeEventListener('pointercancel', this.up)
      element.removeEventListener('pointerleave', this.leave)
      element.removeEventListener('wheel', this.wheel)
    }
  }

  private local(event: PointerEvent | WheelEvent): Point {
    const box = this.element.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  private pick(at: Point): number {
    const { match, analysis, frame } = useReplay.getState()
    if (match === null || analysis === null) return -1
    const { viewport } = useCamera.getState()
    return slotAt({ match, analysis, frame, camera: this.camera(), viewport }, at)
  }

  private spread(): { gap: number; middle: Point } | null {
    const [a, b] = [...this.pointers.values()]
    if (a === undefined || b === undefined) return null
    return {
      gap: Math.hypot(a.x - b.x, a.y - b.y),
      middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  /** Stores the followed view as the camera and stops following, before a manual move. */
  private release(): void {
    if (useReplay.getState().follow === 'off') return
    useCamera.setState({ camera: this.camera() })
    useReplay.getState().setFollow('off')
  }

  private readonly down = (event: PointerEvent) => {
    this.element.setPointerCapture(event.pointerId)
    this.pointers.set(event.pointerId, this.local(event))
    if (this.pointers.size === 2) {
      this.pinch = this.spread()?.gap ?? 0
      this.drag = null
      return
    }
    this.drag = {
      id: event.pointerId,
      start: this.local(event),
      camera: this.camera(),
      moved: false,
    }
  }

  private readonly move = (event: PointerEvent) => {
    const at = this.local(event)
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, at)
    if (this.pointers.size === 2) this.pinchTo()
    else if (this.drag?.id === event.pointerId) this.dragTo(this.drag, at)
    else if (event.pointerType === 'mouse') this.hover(this.pick(at))
  }

  private pinchTo(): void {
    const next = this.spread()
    if (next === null || next.gap === 0 || this.pinch === 0) return
    this.release()
    useCamera.getState().zoomBy(next.gap / this.pinch, next.middle)
    this.pinch = next.gap
  }

  private dragTo(drag: Drag, at: Point): void {
    const dx = at.x - drag.start.x
    const dy = at.y - drag.start.y
    if (!drag.moved && Math.hypot(dx, dy) < CLICK_SLOP_PX) return
    if (!drag.moved) {
      drag.moved = true
      this.release()
    }
    useCamera.getState().pan(dx, dy, drag.camera)
  }

  private hover(slot: number): void {
    if (slot === this.hovered) return
    this.hovered = slot
    this.onHover(slot)
  }

  private readonly up = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId)
    if (this.pointers.size < 2) this.pinch = 0
    if (this.drag?.id !== event.pointerId) return
    if (!this.drag.moved) useReplay.getState().select(this.pick(this.local(event)))
    this.drag = null
  }

  private readonly leave = () => this.hover(-1)

  private readonly wheel = (event: WheelEvent) => {
    event.preventDefault()
    this.release()
    useCamera.getState().zoomBy(Math.exp(-event.deltaY * WHEEL_ZOOM), this.local(event))
  }
}
