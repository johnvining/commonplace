import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PullToRefresh from '../PullToRefresh'

afterEach(cleanup)

function drag(target: Element, from: number, to: number) {
  fireEvent.touchStart(target, { touches: [{ clientY: from }] })
  fireEvent.touchMove(target, { touches: [{ clientY: to }] })
}

describe('PullToRefresh (#364)', () => {
  it('reloads after a long enough pull from the top', () => {
    const onRefresh = vi.fn()
    render(<PullToRefresh enabled onRefresh={onRefresh} />)
    drag(document.body, 10, 120)
    expect(screen.getByText('Release to refresh')).toBeTruthy()
    fireEvent.touchEnd(document.body)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(screen.queryByText('Release to refresh')).toBeNull()
  })

  it('keeps a pull going while it re-renders, with the default reload', () => {
    // The default callback is a new function each render; a pull must
    // survive the re-renders its own progress causes
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    try {
      render(<PullToRefresh enabled />)
      fireEvent.touchStart(document.body, { touches: [{ clientY: 10 }] })
      fireEvent.touchMove(document.body, { touches: [{ clientY: 50 }] })
      fireEvent.touchMove(document.body, { touches: [{ clientY: 120 }] })
      fireEvent.touchEnd(document.body)
      expect(reload).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does nothing for a short pull', () => {
    const onRefresh = vi.fn()
    render(<PullToRefresh enabled onRefresh={onRefresh} />)
    drag(document.body, 10, 40)
    expect(screen.getByText('Pull to refresh')).toBeTruthy()
    fireEvent.touchEnd(document.body)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('is off while anything is being edited', () => {
    const onRefresh = vi.fn()
    render(<><PullToRefresh enabled onRefresh={onRefresh} /><input data-testid="field" /></>)
    drag(document.body, 10, 200)
    fireEvent.touchEnd(document.body)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('leaves drags in a text field alone', () => {
    const onRefresh = vi.fn()
    render(<><PullToRefresh enabled onRefresh={onRefresh} /><textarea data-testid="field" /></>)
    drag(screen.getByTestId('field'), 10, 200)
    fireEvent.touchEnd(screen.getByTestId('field'))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('is off outside the installed app', () => {
    const onRefresh = vi.fn()
    render(<PullToRefresh enabled={false} onRefresh={onRefresh} />)
    drag(document.body, 10, 200)
    fireEvent.touchEnd(document.body)
    expect(onRefresh).not.toHaveBeenCalled()
  })
})
