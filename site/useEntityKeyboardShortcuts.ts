import { useKeyboardShortcuts, shortcuts } from './KeyboardContext'
import * as constants from './constants'

interface EntityKeyboardShortcutsOptions {
  isEditing?: boolean
  onEdit?: () => void
  onSave?: () => unknown
  onExitEdit?: () => void
  onNewNote?: () => unknown
  onEditPiles?: () => void
  onToggleStar?: () => void
  // Single keys for the rest of an entity page's buttons (Section 3.1)
  onEditIdeas?: () => void
  onDelete?: () => unknown
  onViewNotes?: () => void
  onNarrow?: () => void
  onRead?: () => void
  onImport?: () => void
  onUploadImages?: () => void
  onBack?: () => void
}

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
  ...more
}: EntityKeyboardShortcutsOptions) {
  // Entity edit mode shortcuts (Section 3.1)
  useKeyboardShortcuts(
    constants.keyboardScopes.ENTITY_EDIT,
    (event: any) => {
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
    (event: any) => {
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

      // The other buttons: # delete, Ctrl+T ideas, v notes, f narrow,
      // r read, i import, Ctrl+U upload images, b back.
      const extra: [(e: KeyboardEvent) => boolean, (() => unknown) | undefined][] = [
        [shortcuts.entity.delete, more.onDelete],
        [shortcuts.entity.editIdeas, more.onEditIdeas],
        [shortcuts.entity.viewNotes, more.onViewNotes],
        [shortcuts.entity.narrow, more.onNarrow],
        [shortcuts.entity.read, more.onRead],
        [shortcuts.entity.importNotes, more.onImport],
        [shortcuts.entity.uploadImages, more.onUploadImages],
        [shortcuts.entity.back, more.onBack],
      ]
      for (const [matches, run] of extra) {
        if (run && matches(event)) {
          run()
          return true
        }
      }

      // Escape: Exit any mode (piles edit, etc.)
      if (shortcuts.entity.exitEdit(event) && onExitEdit) {
        onExitEdit()
        return true
      }

      return false
    },
    [isEditing, onEdit, onNewNote, onEditPiles, onToggleStar, onExitEdit, more]
  )
}
