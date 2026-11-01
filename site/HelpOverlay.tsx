import * as constants from './constants'

// Help overlay component that displays context-sensitive keyboard shortcuts
// Triggered by Ctrl+H globally

function HelpOverlay({ isVisible, onClose, currentContext }: any) {
  if (!isVisible) return null

  interface ShortcutSection {
    title: string
    shortcuts: { key: string; action: string }[]
  }

  // Determine which shortcuts to show based on context
  const getContextualShortcuts = () => {
    const activeScopes: Set<string> = currentContext.activeScopes instanceof Set
      ? currentContext.activeScopes
      : new Set(currentContext.activeScopes || [])
    const hasScope = (scope: string) => activeScopes.has(scope)
    const sections: ShortcutSection[] = []

    // Always show global shortcuts
    sections.push({
      title: 'Global',
      shortcuts: [
        { key: '/ or Ctrl+O', action: 'Search' },
        { key: '? or Ctrl+/', action: 'Toggle this help' },
        { key: 'h', action: 'Home' },
        { key: 'c', action: 'Create a note' },
        { key: 'd', action: 'Day / night / system' },
        { key: 'Cmd+. or Ctrl+[', action: 'Same as Escape (for keyboards without one)' },
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
          { key: 'Ctrl+S', action: 'Star / unstar' },
          { key: 'Ctrl+N', action: 'Create new note' },
          { key: 'Ctrl+P', action: 'Edit piles' },
          { key: 'Ctrl+T', action: 'Edit ideas (work)' },
          { key: 'v', action: 'View notes / all' },
          { key: 'f', action: 'Narrow (filter)' },
          { key: 'r / i', action: 'Read / import (work)' },
          { key: 'Ctrl+U', action: 'Upload images (work)' },
          { key: 'b', action: 'Back to author' },
          { key: '#', action: 'Delete (asks first)' },
          { key: 'Escape', action: 'Exit edit mode' },
        ],
      })
    }

    // Selecting notes (slim, grid, tile)
    if (
      currentContext.viewMode !== constants.view_modes.FULL &&
      !currentContext.searchBarOpen &&
      hasScope(constants.keyboardScopes.NOTE_LIST)
    ) {
      sections.push({
        title: 'Selecting Notes',
        shortcuts: [
          { key: 'x', action: 'Select focused note' },
          { key: '*', action: 'Select all / none' },
          { key: '#', action: 'Delete selected' },
          { key: 'Ctrl+T / w / @ / Ctrl+P', action: 'Add idea / work / author / pile' },
          { key: 'Ctrl+R / Ctrl+S', action: 'OCR / suggest titles' },
          { key: 'y', action: 'Copy as list' },
          { key: '[ / ]', action: 'Previous / next page' },
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
          { key: 'j / k', action: 'Next / previous note (and page)' },
          { key: 'Enter', action: 'Select note (again: open it)' },
          { key: 'Escape', action: 'Deselect note' },
          { key: 'e', action: 'Edit note' },
          { key: 'o', action: 'Open selected note' },
          { key: '[ / ]', action: 'Previous / next page' },
          { key: 'Ctrl+E', action: 'Edit note' },
          { key: 'Ctrl+T', action: 'Edit tags/ideas' },
          { key: 'Ctrl+P', action: 'Edit piles' },
        ],
      })
    }

    if (hasScope(constants.keyboardScopes.FLIP)) {
      sections.push({
        title: 'Flip',
        shortcuts: [
          { key: '1', action: 'See again fast' },
          { key: '2', action: 'See again medium' },
          { key: '3', action: 'See again slow' },
          { key: 'n', action: 'Next card (no rating)' },
          { key: 'p', action: 'Previous card' },
          { key: 'Enter', action: 'Deal again (deck done)' },
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
          { key: 'Ctrl+R', action: 'Run OCR' },
          { key: 'Ctrl+U', action: 'Upload images' },
          { key: 'Ctrl+M', action: 'Fewer / all fields' }
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
          { key: 'Ctrl+I', action: 'Image beside text (Esc closes)' },
          { key: '← or Ctrl+J', action: 'Previous image' },
          { key: '→ or Ctrl+K', action: 'Next image' }
        )
      }

      if (currentContext.noteMode === constants.note_modes.SELECTED) {
        noteShortcuts.push({ key: 'Ctrl+S', action: 'Star / unstar note' })
        noteShortcuts.push({ key: 'y', action: 'Copy nick' })
        noteShortcuts.push({ key: 'm', action: 'Show more' })
        noteShortcuts.push({ key: 'z', action: 'Zoom open image' })
        noteShortcuts.push({ key: '#', action: 'Delete note' })
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
      <div className="help-overlay-content" onClick={(e: any) => e.stopPropagation()}>
        <div className="help-overlay-header">
          <h2>Keyboard Shortcuts</h2>
          <span className="help-overlay-hint">? or Esc to close</span>
        </div>
        <div className="help-overlay-sections">
          {sections.map((section: any) => (
            <div key={section.title} className="help-section">
              <h3>{section.title}</h3>
              <table>
                <tbody>
                  {section.shortcuts.map((shortcut: any) => (
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
