import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TopBarTimer from '../TopBarTimer'

const getRunningTimer = vi.fn()
const getInfo = vi.fn()

vi.mock('../Database', () => ({
  getRunningTimer: (...args: any[]) => getRunningTimer(...args),
  getInfo: (...args: any[]) => getInfo(...args),
  types: { pile: 'pile', work: 'work' },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TopBarTimer', () => {
  it('shows the pile name instead of its internal ID when the timer has no label', async () => {
    getRunningTimer.mockResolvedValue({
      data: {
        data: {
          timer: {
            key: 'pile:6b05015c8eb302e3799d0e71',
            kind: 'reading',
            label: '',
            startedAt: new Date().toISOString(),
          },
        },
      },
    })
    getInfo.mockResolvedValue({ data: { data: { name: 'Piece: You Know they Refused Jesus, Too?' } } })

    render(
      <MemoryRouter>
        <TopBarTimer />
      </MemoryRouter>
    )

    expect(await screen.findByText('Piece: You Know they Refused Jesus, Too?')).toBeTruthy()
    expect(screen.queryByText('6b05015c8eb302e3799d0e71')).toBeNull()
    expect(getInfo).toHaveBeenCalledWith('pile', '6b05015c8eb302e3799d0e71')
  })
})
