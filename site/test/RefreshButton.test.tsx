import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import RefreshButton from '../RefreshButton'

function standalone(on: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: on && query === '(display-mode: standalone)',
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as any
}

afterEach(cleanup)

describe('RefreshButton (#364)', () => {
  it('is hidden in a browser tab', () => {
    standalone(false)
    render(<RefreshButton onRefresh={() => {}} />)
    expect(screen.queryByLabelText('Refresh')).toBeNull()
  })

  it('reloads from the installed app', () => {
    standalone(true)
    const onRefresh = vi.fn()
    render(<RefreshButton onRefresh={onRefresh} />)
    fireEvent.click(screen.getByLabelText('Refresh'))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
