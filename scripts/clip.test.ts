import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { UsageError, defaultOut, parseClipArgs, themeCss } from './clip.ts'

const PALETTE_VARS = [
  '--background',
  '--pitch',
  '--pitch-line',
  '--team-l',
  '--team-r',
  '--team-l-ink',
  '--team-r-ink',
  '--ball',
  '--ball-ring',
  '--foreground',
  '--muted-foreground',
  '--ring',
  '--event-goal',
  '--event-shot',
  '--event-foul',
  '--event-card',
]

describe('parseClipArgs', () => {
  test('reads the log, the cycles and the defaults', () => {
    expect(parseClipArgs(['logs/jogo.rcg.gz', '2595', '2745'])).toEqual({
      input: 'logs/jogo.rcg.gz',
      from: 2595,
      to: 2745,
      out: 'jogo-2595-2745.gif',
      width: 720,
      theme: 'dark',
      mp4: false,
      rcg: false,
      json: false,
    })
  })

  test('reads every option', () => {
    const args = ['a.rcg', '1', '2', '--out', 'x.gif', '--width', '600', '--theme', 'light']
    expect(parseClipArgs([...args, '--mp4', '--rcg', '--json'])).toMatchObject({
      out: 'x.gif',
      width: 600,
      theme: 'light',
      mp4: true,
      rcg: true,
      json: true,
    })
  })

  test('refuses a bad command line with a usage error', () => {
    for (const argv of [
      [],
      ['a.rcg', '10'],
      ['a.rcg', '10', 'x'],
      ['a.rcg', '10', '5'],
      ['a.rcg', '1', '2', 'extra'],
      ['a.rcg', '1', '2', '--theme', 'blue'],
      ['a.rcg', '1', '2', '--width', '-3'],
      ['a.rcg', '1', '2', '--width', '200'],
      ['a.rcg', '1', '2', '--width', '2000'],
      ['a.rcg', '', '2'],
      ['a.rcg', '1e3', '2000'],
      ['a.rcg', '0x10', '20'],
    ]) {
      expect(() => parseClipArgs(argv)).toThrow(UsageError)
    }
  })
})

describe('defaultOut', () => {
  test('drops the log extension', () => {
    expect(defaultOut('/x/final.rcg', 1, 9)).toBe('final-1-9.gif')
    expect(defaultOut('final.RCG.GZ', 1, 9)).toBe('final-1-9.gif')
  })
})

describe('themeCss', () => {
  test('keeps every variable the palette reads, in both themes', () => {
    const css = themeCss(readFileSync(join(import.meta.dir, '..', 'src', 'index.css'), 'utf8'))
    const [light, dark] = css.split(/^\.dark /m)
    for (const name of PALETTE_VARS) {
      expect(light).toContain(`${name}:`)
      expect(dark).toContain(`${name}:`)
    }
    expect(css).not.toContain('@import')
  })

  test('fails loudly when the theme blocks move', () => {
    expect(() => themeCss('@theme { --x: 1; }')).toThrow('expected one :root and one .dark')
  })
})
