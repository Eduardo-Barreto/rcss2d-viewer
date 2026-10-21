import { beforeEach, describe, expect, test } from 'bun:test'

import { fireEvent, render, screen } from '@testing-library/react'

import { useReplay } from '@/player/store'
import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { MESSAGES_PAGE, MessagesTab } from './messages-tab'

const TOTAL = MESSAGES_PAGE * 2 + 5

const match = parseRcgText(
  rcgText(
    showLine(1, [0, 0, 0, 0], []),
    ...Array.from({ length: TOTAL }, (_, i) => `(msg 1 2 "m${i}")`),
  ),
)

beforeEach(() => {
  useReplay.getState().close()
  useReplay.getState().show(match, 'jogo.rcg')
})

describe('MessagesTab', () => {
  test('renders a page of messages and adds one per click', () => {
    render(<MessagesTab />)
    expect(screen.getAllByRole('listitem')).toHaveLength(MESSAGES_PAGE)
    fireEvent.click(
      screen.getByRole('button', {
        name: `Mostrar mais ${MESSAGES_PAGE} de ${TOTAL - MESSAGES_PAGE}`,
      }),
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(MESSAGES_PAGE * 2)
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais 5 de 5' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(TOTAL)
    expect(screen.queryByRole('button', { name: /Mostrar mais/ })).toBeNull()
  })
})
