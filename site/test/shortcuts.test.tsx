import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { KeyboardProvider, useKeyboardShortcuts, useKeyboardScopes, shortcuts } from '../KeyboardContext'
import * as constants from '../constants'

function key(keyCode: number, mods: Partial<KeyboardEvent> = {}) {
  return new KeyboardEvent('keydown', { keyCode, ...mods } as KeyboardEventInit)
}

describe('shortcuts', () => {
  it('c creates a note', () => {
    expect(shortcuts.global.newNote(key(constants.keyCodes.create))).toBe(true)
  })

  it('Cmd+C is left to the browser for copying', () => {
    expect(shortcuts.global.newNote(key(constants.keyCodes.create, { metaKey: true }))).toBe(false)
  })

  it('Cmd+J does not move through the list', () => {
    expect(shortcuts.noteList.next(key(constants.keyCodes.listNext, { metaKey: true }))).toBe(false)
  })
})

afterEach(cleanup)

function Registers({ scope }: { scope: string | null }) {
  useKeyboardShortcuts(scope, () => false)
  return null
}

function Scopes() {
  return <div data-testid="scopes">{Array.from(useKeyboardScopes()).join(',')}</div>
}

describe('useKeyboardShortcuts', () => {
  it('registers no scope for a null scope (#352)', () => {
    render(
      <KeyboardProvider>
        <Registers scope={null} />
        <Registers scope={constants.keyboardScopes.FLIP} />
        <Scopes />
      </KeyboardProvider>
    )
    expect(screen.getByTestId('scopes').textContent).toBe(constants.keyboardScopes.FLIP)
  })
})
