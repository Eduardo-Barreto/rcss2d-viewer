import { describe, expect, mock, test } from 'bun:test'

import { fireEvent, render, screen } from '@testing-library/react'

import { HelpDialog } from './help-dialog'

describe('HelpDialog', () => {
  test('gives every key its own cap', () => {
    render(<HelpDialog onOpenChange={() => undefined} open />)
    const caps = screen.getAllByText((_, element) => element?.tagName === 'KBD')
    const labels = caps.map((cap) => cap.textContent)
    expect(labels).toContain('Home')
    expect(labels).toContain('End')
    expect(labels.every((label) => !/\s/.test(label))).toBe(true)
  })

  test('closes from a visible button', () => {
    const onOpenChange = mock((_: boolean) => undefined)
    render(<HelpDialog onOpenChange={onOpenChange} open />)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
