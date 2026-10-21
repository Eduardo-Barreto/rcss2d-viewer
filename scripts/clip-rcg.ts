#!/usr/bin/env bun
/**
 * Cuts a cycle range out of a text `.rcg` (v4 to v6) and writes it gzipped. The landing page
 * plays a clip made by this script, so anyone can rebuild it from the published log:
 *
 *   bun scripts/clip-rcg.ts <input.rcg> <from> <to> <output.rcg.gz>
 *
 * The header (format line, parameters, player types and the cycle-0 messages that carry the
 * team logos) is kept whole. The last `playmode` and `team` lines before `from` are kept too,
 * so the clip opens with the right play mode and score instead of the defaults.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const TIMED = /^\((?<kind>show|playmode|team|msg|draw) (?<cycle>\d+)[ )]/

interface Timed {
  kind: string
  cycle: number
}

function timed(line: string): Timed | null {
  const groups = TIMED.exec(line)?.groups
  if (groups?.kind === undefined || groups.cycle === undefined) return null
  return { kind: groups.kind, cycle: Number(groups.cycle) }
}

function checkRange(from: number, to: number): void {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    throw new RangeError(`bad cycle range ${String(from)}..${String(to)}`)
  }
}

/** Lines of `text` that belong to cycles `from..to`, plus the header and the state before. */
export function clipLog(text: string, from: number, to: number): string {
  checkRange(from, to)
  const header: string[] = []
  const body: string[] = []
  const before = new Map<string, string>()
  for (const line of text.split('\n')) {
    const time = timed(line)
    if (time === null || time.cycle === 0) {
      if (body.length === 0 && line.trim() !== '') header.push(line)
    } else if (time.cycle > to) {
      break
    } else if (time.cycle < from) {
      before.set(time.kind, line)
    } else {
      body.push(line)
    }
  }
  if (body.length === 0) throw new RangeError(`no line in cycles ${String(from)}..${String(to)}`)
  const carried = ['playmode', 'team'].flatMap((kind) => before.get(kind) ?? [])
  return `${[...header, ...carried, ...body].join('\n')}\n`
}

if (import.meta.main) {
  const [input, from, to, output] = process.argv.slice(2)
  if (input === undefined || from === undefined || to === undefined || output === undefined) {
    console.error('usage: bun scripts/clip-rcg.ts <input.rcg> <from> <to> <output.rcg.gz>')
    process.exit(2)
  }
  const clip = clipLog(readFileSync(input, 'utf8'), Number(from), Number(to))
  writeFileSync(output, gzipSync(clip, { level: 9 }))
  console.log(JSON.stringify({ output, bytes: Buffer.byteLength(clip) }))
}
