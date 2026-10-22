import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { fireEvent, render, screen } from '@testing-library/react'

import { analyzeMatch } from '@/analysis/analyze'
import { useReplay } from '@/player/store'
import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { ClipDialog } from './clip-dialog'

const LAST_CYCLE = 700

function showing(cycle: number): void {
  const lines = Array.from({ length: LAST_CYCLE }, (_, i) => showLine(i + 1, [0, 0, 0, 0], []))
  const match = parseRcgText(rcgText(...lines))
  useReplay.setState({
    status: 'ready',
    match,
    analysis: analyzeMatch(match),
    name: 'final.rcg.gz',
    frame: cycle - 1,
  })
}

beforeEach(() => {
  useReplay.getState().close()
})

describe('ClipDialog', () => {
  test('starts on a range around the current cycle and says how long it plays', () => {
    showing(200)
    render(<ClipDialog onOpenChange={() => undefined} open />)
    expect(screen.getByLabelText<HTMLInputElement>('Do ciclo').value).toBe('100')
    expect(screen.getByLabelText<HTMLInputElement>('Até o ciclo').value).toBe('250')
    expect(screen.getByText('151 quadros, 15,1 s de jogo.')).toBeDefined()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Gerar GIF' }).disabled).toBe(
      false,
    )
  })

  test('disables the button and says why when the range cannot be clipped', () => {
    showing(200)
    render(<ClipDialog onOpenChange={() => undefined} open />)
    fireEvent.change(screen.getByLabelText('Até o ciclo'), { target: { value: '50' } })
    expect(screen.getByText('O ciclo final precisa vir depois do inicial.')).toBeDefined()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Gerar GIF' }).disabled).toBe(true)
    expect(screen.getByLabelText('Do ciclo').getAttribute('aria-invalid')).toBe('true')
  })

  test('refuses a clip longer than GitHub shows inline', () => {
    showing(200)
    render(<ClipDialog onOpenChange={() => undefined} open />)
    fireEvent.change(screen.getByLabelText('Do ciclo'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Até o ciclo'), { target: { value: '700' } })
    expect(screen.getByText(/O trecho passa de 600 quadros/)).toBeDefined()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Gerar GIF' }).disabled).toBe(true)
  })

  test('puts the caret on the first cycle', () => {
    showing(200)
    render(<ClipDialog onOpenChange={() => undefined} open />)
    expect(document.activeElement).toBe(screen.getByLabelText('Do ciclo'))
  })

  test('closes from a visible button', () => {
    showing(10)
    const onOpenChange = mock((_: boolean) => undefined)
    render(<ClipDialog onOpenChange={onOpenChange} open />)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('renders nothing without a match', () => {
    render(<ClipDialog onOpenChange={() => undefined} open />)
    expect(screen.queryByText('Salvar GIF do lance')).toBeNull()
  })
})
