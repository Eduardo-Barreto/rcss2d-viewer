import { beforeEach, describe, expect, test } from 'bun:test'

import { fireEvent, render, screen } from '@testing-library/react'

import { useReplay } from '@/player/store'
import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { ParamsTab } from './params-tab'

function open(...lines: string[]): void {
  useReplay.getState().close()
  useReplay.getState().show(parseRcgText(rcgText(...lines, showLine(1, [0, 0, 0, 0], []))), 'j.rcg')
}

beforeEach(() => open('(server_param (goal_width 14.02)(ball_decay 0.94))'))

describe('ParamsTab', () => {
  test('says which search found nothing', () => {
    render(<ParamsTab />)
    fireEvent.change(screen.getByLabelText('Buscar parâmetro'), { target: { value: ' xyz ' } })
    expect(screen.getByText('Nenhum parâmetro com “xyz”.')).toBeDefined()
  })

  test('says when the log has no parameters', () => {
    open()
    render(<ParamsTab />)
    expect(screen.getByText('Este log não traz parâmetros.')).toBeDefined()
  })
})
