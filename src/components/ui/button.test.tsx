import { describe, expect, test } from 'bun:test'

import { render, screen } from '@testing-library/react'

import { Button } from './button'

describe('Button', () => {
  test('animates only paint and a press, never every property', () => {
    render(<Button>Abrir</Button>)
    const classes = screen.getByRole('button', { name: 'Abrir' }).className.split(' ')
    expect(classes).not.toContain('transition-all')
    expect(classes.some((name) => name.includes('translate-y'))).toBe(false)
    expect(classes).toContain('active:not-aria-[haspopup]:scale-[0.97]')
  })
})
