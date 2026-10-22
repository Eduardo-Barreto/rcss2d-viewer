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

  test('explains the marks with a visible legend', () => {
    render(<Comparison />)
    const legend = screen.getByRole('list', { name: COPY.comparison.legend })
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Sim', 'Em parte', 'Não'])
  })

  test('keeps the rows where rcssmonitor wins', () => {
    render(<Comparison />)
    for (const feature of [
      'Medir distância',
      'Foco, pointto, defesa ilegal, capacidade de fôlego',
    ]) {
      const row = screen.getByRole('rowheader', { name: feature }).closest('tr')
      expect(row).not.toBeNull()
      if (row === null) return
      const [viewer, monitor] = within(row).getAllByRole('cell')
      expect(viewer).toHaveTextContent(COPY.comparison.support.no)
      expect(monitor).toHaveTextContent(COPY.comparison.support.yes)
    }
  })

  test('names the browsers the live mode works in', () => {
    render(<Comparison />)
    const row = screen.getByRole('rowheader', { name: 'Jogo ao vivo *' }).closest('tr')
    if (row === null) throw new Error('no live row')
    const [viewer] = within(row).getAllByRole('cell')
    expect(viewer).toHaveTextContent(COPY.comparison.support.partial)
    expect(viewer).toHaveTextContent(/Firefox sim, Chrome com permissão de rede local, Safari não/)
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
  test('links to the address it shows and highlights the cycle', () => {
    const href = 'https://rcssviewer.tapout.gg/app?url=https%3A%2F%2Fx.dev%2Fa.rcg.gz#t=2711'
    render(<LinkFigure href={href} />)
    expect(screen.getByRole('link', { name: /x\.dev%2Fa\.rcg\.gz/ })).toHaveAttribute('href', href)
    expect(screen.getByText('#t=2711')).toBeVisible()
  })
})

describe('SafetyFacts', () => {
  test('states the parser limits from the parser itself', () => {
    render(<SafetyFacts />)
    expect(screen.getAllByRole('listitem')).toHaveLength(COPY.safety.facts.length)
    expect(screen.getByText('Até 512 MiB de texto descompactado.')).toBeVisible()
    expect(screen.getByText('Até 40 mil quadros por partida.')).toBeVisible()
  })
})
