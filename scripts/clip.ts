#!/usr/bin/env bun
/**
 * Exports cycles `from..to` of a `.rcg` or `.rcg.gz` as an animated GIF drawn by the viewer's
 * own renderer, for issues and posts. Optionally also an MP4 (needs `ffmpeg`) and the clipped
 * `.rcg.gz`. The drawing runs in headless Chromium, the browser the end-to-end tests install, so
 * the colors and the font are the app's. See ADR 0007.
 *
 *   bun scripts/clip.ts <log.rcg[.gz]> <from> <to> [--out clip.gif] [--width 720]
 *     [--theme dark|light] [--mp4] [--rcg] [--json]
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import { gunzipSync, gzipSync } from 'node:zlib'

import { chromium } from '@playwright/test'

import type { HeadlessReply, HeadlessRequest } from '../src/export/headless-protocol.ts'
import { clipLog } from './clip-rcg.ts'

const ROOT = join(import.meta.dir, '..')
const ORIGIN = 'http://clip.invalid'
const FONT = join(
  ROOT,
  'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
)
const DEFAULT_WIDTH = 720
const POSITIONALS = 3
const GZIP_MAGIC = 0x1f8b
const MS = 1000
const KIB = 1024
const BYTE_BITS = 8
const CAMO_MIB = 5
/** GitHub's image proxy (Camo) refuses anything larger, measured 2026-10-22 (4 MB passes, 6 MB 404s). */
export const CAMO_LIMIT = CAMO_MIB * KIB * KIB

/** What the command line asked for. */
export interface ClipArgs {
  input: string
  from: number
  to: number
  out: string
  width: number
  theme: 'dark' | 'light'
  mp4: boolean
  rcg: boolean
  json: boolean
}

/** A command line that cannot run, exit code 2. */
export class UsageError extends Error {}

function cycle(raw: string | undefined, name: string): number {
  const value = Number(raw)
  if (raw === undefined || !Number.isInteger(value) || value < 0) {
    throw new UsageError(`${name} must be a cycle number, got ${String(raw)}`)
  }
  return value
}

/** Default output: the log's name with the cycles, in the current directory. */
export function defaultOut(input: string, from: number, to: number): string {
  return `${basename(input).replace(/\.rcg(?:\.gz)?$/i, '')}-${from}-${to}.gif`
}

function readArgv(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        width: { type: 'string' },
        theme: { type: 'string' },
        mp4: { type: 'boolean' },
        rcg: { type: 'boolean' },
        json: { type: 'boolean' },
      },
    })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }
}

function widthOf(raw: string | undefined): number {
  const width = raw === undefined ? DEFAULT_WIDTH : Number(raw)
  if (!Number.isInteger(width) || width <= 0) throw new UsageError('width must be a pixel count')
  return width
}

function themeOf(raw: string | undefined): ClipArgs['theme'] {
  const theme = raw ?? 'dark'
  if (theme !== 'dark' && theme !== 'light') throw new UsageError('theme must be dark or light')
  return theme
}

/** Parses `argv` (without the runtime and script). Throws {@link UsageError}. */
export function parseClipArgs(argv: readonly string[]): ClipArgs {
  const { values, positionals } = readArgv(argv)
  const [input, rawFrom, rawTo] = positionals
  if (positionals.length !== POSITIONALS || input === undefined)
    throw new UsageError('expected <log> <from> <to>')
  const from = cycle(rawFrom, 'from')
  const to = cycle(rawTo, 'to')
  if (to < from) throw new UsageError('to must not come before from')
  return {
    input,
    from,
    to,
    out: values.out ?? defaultOut(input, from, to),
    width: widthOf(values.width),
    theme: themeOf(values.theme),
    mp4: values.mp4 === true,
    rcg: values.rcg === true,
    json: values.json === true,
  }
}

/**
 * The theme blocks of `src/index.css` (`:root` and `.dark`), which hold every custom property
 * the renderer's palette reads. The rest of the file is Tailwind, which the page does not need.
 */
export function themeCss(css: string): string {
  const blocks = css.match(/^(?::root|\.dark) \{[\s\S]*?^\}/gm) ?? []
  if (blocks.length !== 2) throw new Error('src/index.css: expected one :root and one .dark block')
  return blocks.join('\n')
}

function page(css: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Geist Variable'; font-weight: 100 900; src: url(${ORIGIN}/geist.woff2) format('woff2'); }
${css}
</style></head><body><script type="module" src="${ORIGIN}/clip.js"></script></body></html>`
}

async function bundle(): Promise<string> {
  const built = await Bun.build({
    entrypoints: [join(ROOT, 'src/export/headless.ts')],
    target: 'browser',
    format: 'esm',
  })
  const [output] = built.outputs
  if (!built.success || output === undefined)
    throw new Error(built.logs.map((log) => log.message).join('\n'))
  return output.text()
}

async function render(args: ClipArgs, log: Uint8Array): Promise<HeadlessReply> {
  const [script, css] = await Promise.all([
    bundle(),
    Promise.resolve(themeCss(readFileSync(join(ROOT, 'src/index.css'), 'utf8'))),
  ])
  const files: Record<string, { body: string | Buffer | Uint8Array; type: string }> = {
    '/': { body: page(css), type: 'text/html' },
    '/clip.js': { body: script, type: 'text/javascript' },
    '/geist.woff2': { body: readFileSync(FONT), type: 'font/woff2' },
    '/log': { body: log, type: 'application/octet-stream' },
  }
  const browser = await chromium.launch()
  try {
    const tab = await browser.newPage()
    await tab.route(`${ORIGIN}/**`, (route) => {
      const file = files[new URL(route.request().url()).pathname]
      return file === undefined
        ? route.fulfill({ status: 404 })
        : route.fulfill({ body: Buffer.from(file.body), contentType: file.type })
    })
    await tab.goto(`${ORIGIN}/`)
    await tab.waitForFunction(() => typeof globalThis.rcssClip === 'function')
    const request: HeadlessRequest = {
      log: `${ORIGIN}/log`,
      from: args.from,
      to: args.to,
      width: args.width,
      theme: args.theme,
    }
    return await tab.evaluate((r) => rcssClip(r), request)
  } finally {
    await browser.close()
  }
}

function logText(bytes: Uint8Array): string {
  const gz = bytes.length > 1 && ((bytes[0] ?? 0) << BYTE_BITS) + (bytes[1] ?? 0) === GZIP_MAGIC
  return new TextDecoder().decode(gz ? gunzipSync(bytes) : bytes)
}

function toMp4(gif: string): string {
  const out = `${gif.replace(/\.gif$/i, '')}.mp4`
  const result = spawnSync(
    'ffmpeg',
    [
      '-nostdin',
      '-y',
      '-loglevel',
      'error',
      '-i',
      gif,
      '-movflags',
      '+faststart',
      '-pix_fmt',
      'yuv420p',
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:v',
      'libx264',
      out,
    ],
    { encoding: 'utf8' },
  )
  if (result.error !== undefined) throw new Error(`ffmpeg: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`ffmpeg: ${result.stderr.trim()}`)
  return out
}

/** One clip export, as printed by `--json`. */
export interface ClipReport {
  gif: string
  bytes: number
  from: number
  to: number
  frames: number
  width: number
  height: number
  seconds: number
  ms: number
  mp4?: { path: string; bytes: number }
  rcg?: { path: string; bytes: number }
  /** Set when the GIF will not show inline on GitHub. */
  warning?: string
}

async function run(args: ClipArgs): Promise<ClipReport> {
  const started = performance.now()
  const log = readFileSync(args.input)
  const reply = await render(args, log)
  const gif = Buffer.from(reply.gif, 'base64')
  writeFileSync(args.out, gif)
  const report: ClipReport = {
    gif: args.out,
    bytes: gif.length,
    from: reply.from,
    to: reply.to,
    frames: reply.frames,
    width: reply.width,
    height: reply.height,
    seconds: (reply.frames * reply.stepMs) / MS,
    ms: 0,
  }
  if (gif.length > CAMO_LIMIT) {
    report.warning =
      'GIF over 5 MiB: GitHub will not show it inline. Use a shorter range or --width 600.'
  }
  if (args.rcg) {
    const path = `${args.out.replace(/\.gif$/i, '')}.rcg.gz`
    writeFileSync(path, gzipSync(clipLog(logText(log), reply.from, reply.to), { level: 9 }))
    report.rcg = { path, bytes: statSync(path).size }
  }
  if (args.mp4) {
    const path = toMp4(args.out)
    report.mp4 = { path, bytes: statSync(path).size }
  }
  report.ms = Math.round(performance.now() - started)
  return report
}

function kb(bytes: number): string {
  return `${Math.round(bytes / KIB)} KB`
}

function human(report: ClipReport): string {
  const lines = [
    `${report.gif}: ${kb(report.bytes)}, ${report.frames} frames (cycles ${report.from}-${report.to}), ${report.width}x${report.height}, ${report.ms} ms`,
  ]
  if (report.mp4) lines.push(`${report.mp4.path}: ${kb(report.mp4.bytes)}`)
  if (report.rcg) lines.push(`${report.rcg.path}: ${kb(report.rcg.bytes)}`)
  if (report.warning !== undefined) lines.push(`warning: ${report.warning}`)
  return lines.join('\n')
}

if (import.meta.main) {
  const json = process.argv.includes('--json')
  try {
    const args = parseClipArgs(process.argv.slice(2))
    const report = await run(args)
    process.stdout.write(`${json ? JSON.stringify(report) : human(report)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${json ? JSON.stringify({ error: message }) : `clip: ${message}`}\n`)
    process.exit(error instanceof UsageError ? 2 : 1)
  }
}
