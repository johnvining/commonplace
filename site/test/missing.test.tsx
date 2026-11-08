import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const getFormer = vi.fn()
vi.mock('../Database', () => ({ getFormer: (...args: any[]) => getFormer(...args) }))

import Missing, { isNotFound, whatBecameOf } from '../Missing'

afterEach(() => {
  cleanup()
  getFormer.mockReset()
})

const show = (props: any) => render(<MemoryRouter><Missing {...props} /></MemoryRouter>)

describe('a record that does not exist (#384-#388)', () => {
  it('says so, naming a deleted record when its name is known', () => {
    show({ type: 'work' })
    expect(screen.getByText('Work does not exist')).toBeTruthy()
    cleanup()
    show({ type: 'pile', name: 'Old pile' })
    expect(screen.getByText('Pile “Old pile” was deleted')).toBeTruthy()
  })

  it('tells a missing record from other failures', () => {
    expect(isNotFound({ response: { status: 404 } })).toBe(true)
    expect(isNotFound({ response: { status: 500 } })).toBe(false)
    expect(isNotFound(new Error('network'))).toBe(false)
  })

  it('forwards a merged record, names a deleted one, and knows nothing otherwise', async () => {
    getFormer.mockResolvedValueOnce({ data: { data: { state: 'alias', work: 'kept', mergedFrom: 'Old' } } })
    expect(await whatBecameOf('work', 'old')).toEqual({ forwardTo: 'kept' })
    getFormer.mockResolvedValueOnce({ data: { data: { state: 'retired', name: 'Gone' } } })
    expect(await whatBecameOf('idea', 'x')).toEqual({ name: 'Gone' })
    getFormer.mockResolvedValueOnce({ data: { data: null } })
    expect(await whatBecameOf('pile', 'x')).toEqual({})
    getFormer.mockRejectedValueOnce(new Error('down'))
    expect(await whatBecameOf('note', 'x')).toEqual({})
  })
})
