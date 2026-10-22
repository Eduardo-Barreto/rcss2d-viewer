/**
 * Browser entry for `scripts/clip.ts`. The CLI bundles this file, opens it in headless Chromium
 * with the app's theme variables and font, and calls `rcssClip`. Running in a real
 * browser keeps the clip identical to the app: same canvas, same `oklch()` colors, same font.
 */
import { analyzeMatch } from '@/analysis/analyze'
import { readRcgStream } from '@/rcg/stream'
import { readPalette } from '@/render/palette'

import { exportClipGif } from './export'
import type { HeadlessReply, HeadlessRequest } from './headless-protocol'

const FONT_PROBE = '600 13px "Geist Variable"'
const CHUNK = 0x8000

function base64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(text)
}

globalThis.rcssClip = async (request: HeadlessRequest): Promise<HeadlessReply> => {
  document.documentElement.classList.toggle('dark', request.theme === 'dark')
  await document.fonts.load(FONT_PROBE)
  const response = await fetch(request.log)
  if (response.body === null) throw new Error('log has no body')
  const match = await readRcgStream(response.body)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('no 2d context')
  const analysis = analyzeMatch(match)
  const clip = await exportClipGif(ctx, {
    match,
    analysis,
    palette: readPalette(document.documentElement),
    from: request.from,
    to: request.to,
    width: request.width,
  })
  return {
    gif: base64(clip.gif),
    from: clip.from,
    to: clip.to,
    frames: clip.count,
    width: clip.width,
    height: clip.height,
    stepMs: analysis.physics.stepMs,
  }
}
