import { beforeEach, describe, expect, test } from 'bun:test'

import { fireEvent, render, screen } from '@testing-library/react'

import type { Moment } from '@/player/moments'
import { useReplay } from '@/player/store'
import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { EventsTab } from './events-tab'

const match = parseRcgText(rcgText(showLine(1, [0, 0, 0, 0], [])))

const SET_PIECE: Moment = {
  frame: 0,
  cycle: 1,
  kind: 'setPiece',
  side: 'l',
  slot: -1,
  text: 'Lateral',
  strong: false,
}

const NONE: Moment[] = []
const ONLY_SET_PIECE: Moment[] = [SET_PIECE]

beforeEach(() => {
  useReplay.getState().close()
  useReplay.getState().show(match, 'jogo.rcg')
})

describe('EventsTab', () => {
  test('says when the log has no moments at all', () => {
    render(<EventsTab moments={NONE} />)
    expect(screen.getByText('Este log não tem lances.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Mostrar todos' })).toBeNull()
  })

  test('offers every kind when the filter hides all moments', () => {
    render(<EventsTab moments={ONLY_SET_PIECE} />)
    expect(screen.getByText('Nenhum lance desse tipo.')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todos' }))
    expect(screen.getByRole('button', { name: /Lateral/ })).toBeDefined()
    expect(screen.queryByText('Nenhum lance desse tipo.')).toBeNull()
  })
})
