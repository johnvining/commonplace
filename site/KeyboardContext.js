import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react'
import * as constants from './constants'

const KeyboardContext = createContext(null)

// Scope priority - lower number = higher priority (more specific)
const scopePriority = {
  [constants.keyboardScopes.AUTOCOMPLETE]: 0,
  [constants.keyboardScopes.SEARCH_BAR]: 1,
  [constants.keyboardScopes.NOTE_EDIT]: 1,
  [constants.keyboardScopes.NOTE_EDIT_IDEAS]: 1,
  [constants.keyboardScopes.NOTE_EDIT_PILES]: 1,
  [constants.keyboardScopes.NOTE_EDIT_LINKS]: 1,
  [constants.keyboardScopes.NOTE_SELECTED]: 2,
  [constants.keyboardScopes.NOTE_LIST]: 4,
  [constants.keyboardScopes.ENTITY_EDIT]: 6,
  [constants.keyboardScopes.ENTITY_PAGE]: 7,
  [constants.keyboardScopes.GLOBAL]: 10,
}

export function KeyboardProvider({ children }) {
  const handlers = useRef(new Map())
  const handlerId = useRef(0)
  const scopeCounts = useRef(new Map())
  const [activeScopes, setActiveScopes] = useState(new Set())

  const updateScopeCount = useCallback((scope, delta) => {
    const current = scopeCounts.current.get(scope) || 0
    const next = current + delta
    if (next <= 0) {
      scopeCounts.current.delete(scope)
    } else {
      scopeCounts.current.set(scope, next)
    }
    setActiveScopes(new Set(scopeCounts.current.keys()))
  }, [])

  const register = useCallback((scope, handler) => {
    const id = ++handlerId.current
    handlers.current.set(id, { scope, handler, priority: scopePriority[scope] || 10 })
    updateScopeCount(scope, 1)
    return id
  }, [updateScopeCount])

  const unregister = useCallback((id) => {
    const entry = handlers.current.get(id)
    if (!entry) return
    handlers.current.delete(id)
    updateScopeCount(entry.scope, -1)
  }, [updateScopeCount])

  const handleKeyDown = useCallback((event) => {
    // Skip if user is typing in a non-shortcut input
    const target = event.target
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
    const allowInputShortcuts = target?.dataset?.allowShortcuts === 'true'

    // For inputs, only process Escape, Enter, and Ctrl+key combinations
    if (
      isInput &&
      !event.ctrlKey &&
      event.keyCode !== constants.keyCodes.esc &&
      event.keyCode !== constants.keyCodes.enter &&
      !(event.keyCode === constants.keyCodes.delete && allowInputShortcuts)
    ) {
      return
    }

    // Sort handlers by priority (most specific first)
    const sortedHandlers = Array.from(handlers.current.values())
      .sort((a, b) => a.priority - b.priority)

    // Try each handler until one handles the event
    for (const { handler } of sortedHandlers) {
      const handled = handler(event)
      if (handled) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <KeyboardContext.Provider value={{ register, unregister, activeScopes }}>
      {children}
    </KeyboardContext.Provider>
  )
}

// Hook for components to register keyboard handlers
export function useKeyboardShortcuts(scope, handler, deps = []) {
  const context = useContext(KeyboardContext)
  const register = context?.register
  const unregister = context?.unregister
  const handlerRef = useRef(handler)

  // Always keep the ref updated with the latest handler
  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!register || !unregister) return

    // Use a wrapper that calls the ref so we always get the latest handler
    const wrappedHandler = (event) => handlerRef.current(event)
    const id = register(scope, wrappedHandler)
    return () => unregister(id)
  }, [register, unregister, scope])
}

export function useKeyboardScopes() {
  const context = useContext(KeyboardContext)
  return context?.activeScopes || new Set()
}

// Helper to check key combinations
export function isKey(event, keyCode, { ctrl = false, shift = false, alt = false } = {}) {
  return (
    event.keyCode === keyCode &&
    event.ctrlKey === ctrl &&
    event.shiftKey === shift &&
    event.altKey === alt
  )
}

function isHelpToggle(event) {
  if (!event.ctrlKey) return false
  if (event.key === '/' || event.key === '?') return true
  if (event.code === 'Slash') return true
  return event.keyCode === constants.keyCodes.help
}

// Shortcut definitions matching the documentation hierarchy
export const shortcuts = {
  // 1. Global
  global: {
    toggleSearchBar: (e) => isKey(e, constants.keyCodes.open, { ctrl: true }),
    toggleHelp: (e) => isHelpToggle(e),
    viewFull: (e) => isKey(e, constants.keyCodes.full, { ctrl: true, shift: true }),
    viewSlim: (e) => isKey(e, constants.keyCodes.slim, { ctrl: true, shift: true }),
    viewGrid: (e) => isKey(e, constants.keyCodes.grid, { ctrl: true, shift: true }),
    viewTile: (e) => isKey(e, constants.keyCodes.tile, { ctrl: true, shift: true }),
  },

  // 2. Search Bar
  searchBar: {
    close: (e) => isKey(e, constants.keyCodes.esc),
    execute: (e) => isKey(e, constants.keyCodes.enter),
    back: (e) => isKey(e, constants.keyCodes.delete),
  },

  // 3. Entity Pages
  entity: {
    edit: (e) => isKey(e, constants.keyCodes.edit, { ctrl: true }),
    save: (e) => isKey(e, constants.keyCodes.accept, { ctrl: true }),
    exitEdit: (e) => isKey(e, constants.keyCodes.esc),
    newNote: (e) => isKey(e, constants.keyCodes.new, { ctrl: true }),
    editPiles: (e) => isKey(e, constants.keyCodes.piles, { ctrl: true }),
    star: (e) => isKey(e, constants.keyCodes.suggest, { ctrl: true }),
  },

  // 4. Note List
  noteList: {
    select: (e) => isKey(e, constants.keyCodes.enter),
    deselect: (e) => isKey(e, constants.keyCodes.esc),
    edit: (e) => isKey(e, constants.keyCodes.edit, { ctrl: true }),
    editIdeas: (e) => isKey(e, constants.keyCodes.ideas, { ctrl: true }),
    editPiles: (e) => isKey(e, constants.keyCodes.piles, { ctrl: true }),
  },

  // 5. Note Editing
  note: {
    save: (e) => isKey(e, constants.keyCodes.accept, { ctrl: true }),
    exitEdit: (e) => isKey(e, constants.keyCodes.esc),
    format: (e) => isKey(e, constants.keyCodes.format, { ctrl: true }),
    suggestTitle: (e) => isKey(e, constants.keyCodes.suggest, { ctrl: true }),
    ocr: (e) => isKey(e, constants.keyCodes.ocr, { ctrl: true }),
    toggleImage: (e) => isKey(e, constants.keyCodes.image, { ctrl: true }),
    prevImage: (e) => isKey(e, constants.keyCodes.prevImage, { ctrl: true }),
    nextImage: (e) => isKey(e, constants.keyCodes.nextImage, { ctrl: true }),
    addLink: (e) => isKey(e, constants.keyCodes.enter),
    star: (e) => isKey(e, constants.keyCodes.suggest, { ctrl: true }),
  },

  // 6. Autocomplete
  autocomplete: {
    close: (e) => isKey(e, constants.keyCodes.esc),
    back: (e) => isKey(e, constants.keyCodes.delete),
    suggestIdeas: (e) => isKey(e, constants.keyCodes.suggest, { ctrl: true }),
  },
}

export default KeyboardContext
