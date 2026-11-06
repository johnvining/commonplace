import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import AuthGate from '../AuthGate'

afterEach(cleanup)

const gate = (auth: any, onRetry = () => {}) =>
  render(
    <AuthGate auth={auth} login={() => <div>LOGIN PAGE</div>} onRetry={onRetry}>
      <div>THE SITE</div>
    </AuthGate>
  )

describe('sign-in gate', () => {
  it('shows neither the login page nor the site while the check runs', () => {
    gate('checking')
    expect(screen.queryByText('LOGIN PAGE')).toBeNull()
    expect(screen.queryByText('THE SITE')).toBeNull()
  })

  it('shows the login page when signed out, and the site when signed in', () => {
    gate('out')
    expect(screen.getByText('LOGIN PAGE')).toBeTruthy()
    cleanup()
    gate('in')
    expect(screen.getByText('THE SITE')).toBeTruthy()
  })

  it('offers a retry, not the login page, when the server is unreachable', () => {
    const onRetry = vi.fn()
    gate('unreachable', onRetry)
    expect(screen.queryByText('LOGIN PAGE')).toBeNull()
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
