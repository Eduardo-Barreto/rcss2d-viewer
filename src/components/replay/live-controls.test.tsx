import { beforeEach, describe, expect, test } from 'bun:test'

import { fireEvent, render, screen } from '@testing-library/react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { type LiveState, useReplay } from '@/player/store'
import { parseRcgText } from '@/rcg/parser'
import { rcgText, showLine } from '@/test/rcg-builder'

import { LiveControls, LiveNotice } from './live-controls'
import { OpenLog } from './open-log'

const LIVE: LiveState = {
  url: 'ws://127.0.0.1:6100/',
  phase: 'open',
  server: 'up',
  end: null,
  following: true,
}

function showing(live: Partial<LiveState>, waiting = false): void {
  const last = showLine(2, [0, 0, 0, 0], [])
  const text = rcgText(
    showLine(1, [0, 0, 0, 0], []),
    waiting ? last.replace('(show 2', '(show 2 (pm 1)') : last,
  )
  const match = parseRcgText(text)
  useReplay.setState({ status: 'ready', match, frame: 1, live: { ...LIVE, ...live } })
}

beforeEach(() => {
  useReplay.getState().close()
})

describe('LiveControls', () => {
  test('shows the badge while the playhead is on the newest frame', () => {
    showing({})
    render(<LiveControls />)
    expect(screen.getByText('Ao vivo')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Voltar ao vivo/ })).toBeNull()
  })

  test('offers the way back after a scrub, and takes it', () => {
    showing({ following: false })
    useReplay.setState({ frame: 0 })
    render(
      <TooltipProvider>
        <LiveControls />
      </TooltipProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Voltar ao vivo/ }))
    expect(useReplay.getState().live?.following).toBe(true)
    expect(useReplay.getState().frame).toBe(1)
  })

  test('offers the kick-off only while the server waits for one', () => {
    showing({}, true)
    const { unmount } = render(<LiveControls />)
    expect(screen.getByRole('button', { name: /Começar partida/ })).toBeDefined()
    unmount()
    showing({})
    render(<LiveControls />)
    expect(screen.queryByRole('button', { name: /Começar partida/ })).toBeNull()
  })

  test('is gone once the session ends', () => {
    showing({ phase: 'ended', end: 'closed', following: false })
    const { container } = render(<LiveControls />)
    expect(container.textContent).toBe('')
  })
})

describe('LiveNotice', () => {
  test('says when the relay waits for the server', () => {
    showing({ server: 'down' })
    render(<LiveNotice />)
    expect(screen.getByText(/Esperando o rcssserver/)).toBeDefined()
  })

  test('keeps the frames after the end and offers to save them', () => {
    showing({ phase: 'ended', end: 'closed', following: false })
    render(<LiveNotice />)
    expect(screen.getByText(/continuam aqui/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Salvar .rcg/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /Reconectar/ })).toBeDefined()
  })
})

describe('OpenLog live form', () => {
  test('starts with the default relay address', () => {
    render(<OpenLog dragging={false} />)
    const field = screen.getByLabelText('Endereço ws:// da ponte')
    expect(field instanceof HTMLInputElement && field.value).toBe('ws://127.0.0.1:6100')
  })

  test('refuses a relay outside this machine and points at the field', () => {
    render(<OpenLog dragging={false} />)
    const field = screen.getByLabelText('Endereço ws:// da ponte')
    fireEvent.change(field, { target: { value: 'ws://example.com:6100' } })
    const form = field.closest('form')
    if (form === null) throw new Error('no form')
    fireEvent.submit(form)
    expect(screen.getByRole('alert').textContent).not.toBe('')
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Endereço https de um .rcg').getAttribute('aria-invalid')).toBe(
      'false',
    )
  })
})
