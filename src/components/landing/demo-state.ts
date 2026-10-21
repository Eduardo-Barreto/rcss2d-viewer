import type { Moment } from '@/player/moments'
import type { Overlays } from '@/render/scene'

/** The layers the layer demo shows, in the order it cycles through them. */
export const LAYER_KEYS = ['trails', 'cones', 'offside', 'stamina', 'heatmap'] as const

/** One layer of the demo. */
export type LayerKey = (typeof LAYER_KEYS)[number]

/** The layer shown on the `tick`-th step of the cycle. */
export function layerAt(tick: number): LayerKey {
  const index = ((tick % LAYER_KEYS.length) + LAYER_KEYS.length) % LAYER_KEYS.length
  return LAYER_KEYS[index] ?? 'trails'
}

/** Overlays with only `layer` switched on. */
export function overlaysOf(layer: LayerKey): Overlays {
  return {
    trails: layer === 'trails',
    cones: layer === 'cones',
    offside: layer === 'offside',
    stamina: layer === 'stamina',
    heatmap: layer === 'heatmap',
  }
}

/** The latest moment at or before `frame`, or `null` before the first one. */
export function activeMoment(moments: readonly Moment[], frame: number): Moment | null {
  return moments.findLast((moment) => moment.frame <= frame) ?? null
}
