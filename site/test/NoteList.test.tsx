import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { KeyboardProvider } from '../KeyboardContext'
import NoteList from '../NoteList'
import * as constants from '../constants'

// Stand-in for the full note, showing the mode NoteList hands it.
vi.mock('../Note', () => ({
  default: (props: any) => (
    <div id={props.id} data-note-id={props.id} data-mode={props.mode} tabIndex={0}>
      {props.note.text}
    </div>
  ),
}))

// jsdom has no IntersectionObserver; NoteList uses one to lazy-load images.
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as any

const notes = [
  { _id: 'a', text: 'first' },
  { _id: 'b', text: 'second' },
  { _id: 'c', text: 'third' },
]

const getListOfNotes = async () => ({ data: { data: notes } })

function list(props: any = {}) {
  return (
    <MemoryRouter>
      <KeyboardProvider>
        <NoteList viewMode={constants.view_modes.FULL} getListOfNotes={getListOfNotes} {...props} />
      </KeyboardProvider>
    </MemoryRouter>
  )
}

function renderList(props: any = {}) {
  return render(list(props))
}

function selectedIds() {
  return Array.from(document.querySelectorAll(`[data-mode="${constants.note_modes.SELECTED}"]`)).map(
    (el) => el.id
  )
}

afterEach(cleanup)

describe('NoteList selection', () => {
  it('starts with exactly one note, the first, selected', async () => {
    renderList()
    await screen.findByText('first')
    await waitFor(() => expect(selectedIds()).toEqual(['a']))
  })

  it('moves the selection with j and k from the start', async () => {
    renderList()
    await waitFor(() => expect(selectedIds()).toEqual(['a']))

    fireEvent.keyDown(document.getElementById('a')!, { keyCode: constants.keyCodes.listNext })
    await waitFor(() => expect(selectedIds()).toEqual(['b']))

    fireEvent.keyDown(document.getElementById('b')!, { keyCode: constants.keyCodes.listNext })
    await waitFor(() => expect(selectedIds()).toEqual(['c']))

    fireEvent.keyDown(document.getElementById('c')!, { keyCode: constants.keyCodes.listPrev })
    await waitFor(() => expect(selectedIds()).toEqual(['b']))
  })

  it('selects the first note when switching into Full view', async () => {
    const { rerender } = renderList({ viewMode: constants.view_modes.RESULT })
    await screen.findByText('first')
    rerender(list({ viewMode: constants.view_modes.FULL }))
    await waitFor(() => expect(selectedIds()).toEqual(['a']))
  })
})
