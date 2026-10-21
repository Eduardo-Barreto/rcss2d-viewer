import { describe, expect, test } from 'bun:test'

import { render, screen, within } from '@testing-library/react'

import { SHORTCUTS } from '@/player/keys'

import { COPY } from './copy'
import { Comparison, KeysFigure, LinkFigure, SafetyFacts } from './figures'

describe('Comparison', () => {
  test('has one row per feature with both sides', () => {
    render(<Comparison />)
    const table = screen.getByRole('table', { name: COPY.comparison.caption })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(COPY.comparison.rows.length + 1)
    expect(within(table).getByRole('columnheader', { name: COPY.comparison.monitor })).toBeVisible()
  })

  test('keeps the rows where rcssmonitor wins', () => {
    render(<Comparison />)
    const row = screen.getByRole('rowheader', { name: 'Medir distância' }).closest('tr')
    expect(row).not.toBeNull()
    if (row === null) return
    const [viewer, monitor] = within(row).getAllByRole('cell')
    expect(viewer).toHaveTextContent(COPY.comparison.support.no)
    expect(monitor).toHaveTextContent(COPY.comparison.support.yes)
  })

  test('marks the rows that need the live mode', () => {
    render(<Comparison />)
    const live = COPY.comparison.rows.filter((row) => 'live' in row)
    expect(live.length).toBeGreaterThan(0)
    for (const row of live) {
      expect(screen.getByRole('rowheader', { name: `${row.feature} *` })).toBeVisible()
    }
    expect(screen.getByText(COPY.comparison.liveNote)).toBeVisible()
  })
})

describe('KeysFigure', () => {
  test('lists every shortcut of the app', () => {
    render(<KeysFigure />)
    for (const shortcut of SHORTCUTS) expect(screen.getByText(shortcut.label)).toBeVisible()
  })
})

describe('LinkFigure', () => {
  test('highlights the cycle part of the address', () => {
    render(<LinkFigure />)
    expect(screen.getByText('#t=2711')).toBeVisible()
  })
})

describe('SafetyFacts', () => {
  test('pairs each number with what it limits', () => {
    render(<SafetyFacts />)
    for (const fact of COPY.safety.facts) {
      expect(screen.getByText(fact.value)).toBeVisible()
      expect(screen.getByText(fact.text)).toBeVisible()
    }
  })
})
