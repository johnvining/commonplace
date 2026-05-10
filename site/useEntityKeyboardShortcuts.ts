import { useKeyboardShortcuts, shortcuts } from './KeyboardContext'
import * as constants from './constants'

// Shared keyboard shortcuts for entity pages (Work, Pile, Idea, Read)
// Section 3 in documentation
export function useEntityKeyboardShortcuts({
  isEditing,
  onEdit,
  onSave,
  onExitEdit,
  onNewNote,
  onEditPiles,
  onToggleStar,
}) {
  // Entity edit mode shortcuts (Section 3.1)
  useKeyboardShortcuts(
    constants.keyboardScopes.ENTITY_EDIT,
    (event) => {
      if (!isEditing) return false

      // Ctrl+A: Save changes
      if (shortcuts.entity.save(event) && onSave) {
        onSave()
        return true
      }

      // Escape: Exit edit mode
      if (shortcuts.entity.exitEdit(event) && onExitEdit) {
        onExitEdit()
        return true
      }

      return false
    },
    [isEditing, onSave, onExitEdit]
  )

  // Entity page shortcuts (Section 3.1 - 3.5)
  useKeyboardShortcuts(
    constants.keyboardScopes.ENTITY_PAGE,
    (event) => {
      // Only handle these when NOT editing
      if (isEditing) return false

      // Ctrl+E: Edit entity
      if (shortcuts.entity.edit(event) && onEdit) {
        onEdit()
        return true
      }

      // Ctrl+N: New note
      if (shortcuts.entity.newNote(event) && onNewNote) {
        onNewNote()
        return true
      }

      // Ctrl+P: Edit piles
      if (shortcuts.entity.editPiles(event) && onEditPiles) {
        onEditPiles()
        return true
      }

      // Ctrl+S: Star/unstar entity
      if (shortcuts.entity.star(event) && onToggleStar) {
        onToggleStar()
        return true
      }

      // Escape: Exit any mode (piles edit, etc.)
      if (shortcuts.entity.exitEdit(event) && onExitEdit) {
        onExitEdit()
        return true
      }

      return false
    },
    [isEditing, onEdit, onNewNote, onEditPiles, onToggleStar, onExitEdit]
  )
}
