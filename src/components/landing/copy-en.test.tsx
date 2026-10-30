import { describe, expect, test } from 'bun:test'

import { render, screen, within } from '@testing-library/react'

import { SHORTCUTS } from '@/player/keys'
import { PLAYMODES } from '@/rcg/playmodes'

import { COPY } from './copy'
import { CopyProvider } from './copy-context'
import { COPY_EN } from './copy-en'
import { Comparison, KeysFigure, SafetyFacts } from './figures'

const supports = (each: (typeof COPY.comparison.rows)[number] | undefined) =>
  `${each?.viewer.support}/${each?.monitor.support}`

describe('English copy', () => {
  test('has one entry for every row, shortcut and stat of the Portuguese page', () => {
    expect(COPY_EN.comparison.rows).toHaveLength(COPY.comparison.rows.length)
    COPY_EN.comparison.rows.forEach((row, index) => {
      expect('live' in row).toBe('live' in (COPY.comparison.rows[index] ?? {}))
      const pt = COPY.comparison.rows[index]
      expect(supports(row)).toBe(supports(pt))
    })
    expect(COPY_EN.keys.shortcuts).toHaveLength(SHORTCUTS.length)
    expect(COPY_EN.stats.rows).toHaveLength(10)
    expect(COPY_EN.safety.facts).toHaveLength(COPY.safety.facts.length)
  })

  test('says the same limits as the code', () => {
    expect(COPY_EN.safety.facts[2]?.match(/\d+/)?.[0]).toBe(COPY.safety.facts[2]?.match(/\d+/)?.[0])
    expect(COPY_EN.safety.facts[3]?.match(/\d+/)?.[0]).toBe(COPY.safety.facts[3]?.match(/\d+/)?.[0])
  })

  test('points each language at the other', () => {
    expect(COPY.nav.language).toEqual({ text: 'English', lang: 'en', path: '/en' })
    expect(COPY_EN.nav.language).toEqual({ text: 'Português', lang: 'pt-BR', path: '/' })
    expect(COPY_EN.lang).toBe('en')
    expect(COPY_EN.path).toBe('/en')
  })

  test('names every play mode in English', () => {
    const label = COPY_EN.moments.labels?.playMode
    if (label === undefined) throw new Error('no play mode labels')
    expect(label(PLAYMODES.indexOf('free_kick_l'))).toBe('Free kick')
    expect(label(PLAYMODES.indexOf('goal_kick_r'))).toBe('Goal kick')
    PLAYMODES.forEach((_, mode) => expect(label(mode)).not.toMatch(/_/))
  })

  test('words the moments in English', () => {
    const labels = COPY_EN.moments.labels
    expect(labels?.goalBy('A 9')).toBe('Goal by A 9')
    expect(labels?.shot(true, 'A 9')).toBe('Shot on target: A 9')
    expect(labels?.card(true, 'A 9')).toBe('Red card for A 9')
  })
})

describe('the figures in English', () => {
  test('the shortcut list is in English and says Space, not Espaço', () => {
    render(
      <CopyProvider copy={COPY_EN}>
        <KeysFigure />
      </CopyProvider>,
    )
    expect(screen.getByText('Next goal')).toBeVisible()
    expect(screen.getByText('Space')).toBeVisible()
    expect(screen.queryByText('Espaço')).toBeNull()
    expect(screen.queryByText('ou')).toBeNull()
    expect(screen.getAllByText('or').length).toBeGreaterThan(0)
  })

  test('the comparison and the limits are in English', () => {
    render(
      <CopyProvider copy={COPY_EN}>
        <Comparison />
        <SafetyFacts />
      </CopyProvider>,
    )
    const table = screen.getByRole('table', { name: 'What each one does' })
    expect(within(table).getByRole('rowheader', { name: 'Measure distance' })).toBeVisible()
    expect(screen.getByText('Remote address, https only.')).toBeVisible()
  })
})
