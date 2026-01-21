import React from 'react'
import * as constants from './constants'

// Help overlay component that displays context-sensitive keyboard shortcuts
// Triggered by Ctrl+H globally

function HelpOverlay({ isVisible, onClose, currentContext }) {
  if (!isVisible) return null

  // Determine which shortcuts to show based on context
  const getContextualShortcuts = () => {
    const activeScopes = currentContext.activeScopes instanceof Set
      ? currentContext.activeScopes
      : new Set(currentContext.activeScopes || [])
    const hasScope = (scope) => activeScopes.has(scope)
    const sections = []

    // Always show global shortcuts
    sections.push({
      title: 'Global',
      shortcuts: [
        { key: 'Ctrl+O', action: 'Toggle search bar' },
        { key: 'Ctrl+/', action: 'Toggle this help' },
        { key: 'Ctrl+Shift+1', action: 'Full view' },
        { key: 'Ctrl+Shift+2', action: 'Slim view' },
        { key: 'Ctrl+Shift+3', action: 'Grid view' },
        { key: 'Ctrl+Shift+4', action: 'Tile view' },
      ],
    })

    // Search bar context
    if (currentContext.searchBarOpen || hasScope(constants.keyboardScopes.SEARCH_BAR)) {
      sections.push({
        title: 'Search Bar',
        shortcuts: [
          { key: 'Enter', action: 'Execute command' },
          { key: 'Backspace', action: 'Go back (when empty)' },
          { key: 'Escape', action: 'Close search bar' },
        ],
      })
    }

    // Entity page context
    if (currentContext.entityPage || hasScope(constants.keyboardScopes.ENTITY_PAGE) || hasScope(constants.keyboardScopes.ENTITY_EDIT)) {
      sections.push({
        title: `${currentContext.entityPage || 'Entity'} Page`,
        shortcuts: [
          { key: 'Ctrl+E', action: 'Edit details' },
          { key: 'Ctrl+A', action: 'Save changes' },
          { key: 'Ctrl+N', action: 'Create new note' },
          ...(currentContext.entityPage === 'Work'
            ? [{ key: 'Ctrl+P', action: 'Edit piles' }]
            : []),
          { key: 'Escape', action: 'Exit edit mode' },
        ],
      })
    }

    // Note list context (Full view only)
    if (
      currentContext.viewMode === constants.view_modes.FULL &&
      !currentContext.searchBarOpen &&
      hasScope(constants.keyboardScopes.NOTE_LIST)
    ) {
      sections.push({
        title: 'Note List (Full View)',
        shortcuts: [
          { key: 'Enter', action: 'Select focused note' },
          { key: 'Escape', action: 'Deselect note' },
          { key: 'Ctrl+E', action: 'Edit note' },
          { key: 'Ctrl+T', action: 'Edit tags/ideas' },
          { key: 'Ctrl+P', action: 'Edit piles' },
        ],
      })
    }

    // Note editing context
    if (currentContext.noteMode) {
      const noteShortcuts = [
        { key: 'Ctrl+A', action: 'Save changes' },
        { key: 'Escape', action: 'Exit edit mode' },
      ]

      if (currentContext.noteMode === constants.note_modes.EDIT) {
        noteShortcuts.push(
          { key: 'Ctrl+F', action: 'Format text' },
          { key: 'Ctrl+S', action: 'Suggest title (AI)' },
          { key: 'Ctrl+R', action: 'Run OCR' }
        )
      }

      if (currentContext.noteMode === constants.note_modes.EDIT_LINKS) {
        noteShortcuts.push({ key: 'Enter', action: 'Add link' })
      }

      // Image shortcuts for selected or edit modes
      if (
        currentContext.noteMode === constants.note_modes.SELECTED ||
        currentContext.noteMode === constants.note_modes.EDIT
      ) {
        noteShortcuts.push(
          { key: 'Ctrl+I', action: 'Toggle image zoom' },
          { key: 'Ctrl+J', action: 'Previous image' },
          { key: 'Ctrl+K', action: 'Next image' }
        )
      }

      if (currentContext.noteMode === constants.note_modes.SELECTED) {
        noteShortcuts.push({ key: 'Ctrl+L', action: 'Add link' })
      }

      sections.push({
        title: 'Note Editing',
        shortcuts: noteShortcuts,
      })
    }

    return sections
  }

  const sections = getContextualShortcuts()

  return (
    <div className="help-overlay" onClick={onClose}>
      <div className="help-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="help-overlay-header">
          <h2>Keyboard Shortcuts</h2>
          <span className="help-overlay-hint">Press Ctrl+/ or Escape or click outside to close</span>
        </div>
        <div className="help-overlay-sections">
          {sections.map((section) => (
            <div key={section.title} className="help-section">
              <h3>{section.title}</h3>
              <table>
                <tbody>
                  {section.shortcuts.map((shortcut) => (
                    <tr key={shortcut.key + shortcut.action}>
                      <td className="help-key">
                        <kbd>{shortcut.key}</kbd>
                      </td>
                      <td className="help-action">{shortcut.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HelpOverlay
