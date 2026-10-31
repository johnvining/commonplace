import { describe, it, expect } from 'vitest'
import { shortcuts } from '../KeyboardContext'
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
