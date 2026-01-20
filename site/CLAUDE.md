# Commonplace Site - Development Guide

This file contains important context for Claude Code to maintain the codebase correctly.

## Keyboard Shortcuts Architecture

The keyboard shortcut system is centralized and follows a strict hierarchy. **All three locations must stay in sync**:

1. **`KEYBOARD_SHORTCUTS.md`** - User-facing documentation
2. **`KeyboardContext.js`** - Implementation (shortcuts object)
3. **`HelpOverlay.js`** - In-app help display

### When Adding or Modifying Shortcuts

1. **Update `constants.js`**:
   - Add the key code to `keyCodes` object
   - Add scope to `keyboardScopes` if needed

2. **Update `KeyboardContext.js`**:
   - Add the shortcut checker to the appropriate section in `shortcuts` object
   - Use the `isKey()` helper: `isKey(e, constants.keyCodes.xxx, { ctrl: true })`

3. **Update the component** that handles the shortcut:
   - Use `useKeyboardShortcuts(scope, handler, deps)` hook
   - Return `true` from handler if shortcut was handled

4. **Update `HelpOverlay.js`**:
   - Add the shortcut to the appropriate section in `getContextualShortcuts()`

5. **Update `KEYBOARD_SHORTCUTS.md`**:
   - Add to the appropriate section maintaining the numbered hierarchy

### Shortcut Hierarchy (Priority Order)

Most specific (highest priority) to least specific:
1. `NOTE_EDIT`, `NOTE_EDIT_IDEAS`, `NOTE_EDIT_PILES`, `NOTE_EDIT_LINKS`
2. `NOTE_SELECTED`
3. `AUTOCOMPLETE`
4. `NOTE_LIST`
5. `SEARCH_BAR`
6. `ENTITY_EDIT`
7. `ENTITY_PAGE`
8. `GLOBAL` (lowest priority)

### Key Files

| File | Purpose |
|------|---------|
| `constants.js` | Key codes and scopes |
| `KeyboardContext.js` | Central keyboard management, shortcut definitions |
| `useEntityKeyboardShortcuts.js` | Shared hook for entity pages |
| `HelpOverlay.js` | Ctrl+H help overlay component |
| `App.js` | Global shortcuts (Ctrl+O, Ctrl+H, view modes) |

### Current Shortcuts Summary

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Ctrl+/` | Toggle help overlay | GLOBAL |
| `Ctrl+O` | Toggle search bar | GLOBAL |
| `Ctrl+Shift+1-4` | View modes | GLOBAL |
| `Ctrl+E` | Edit | ENTITY_PAGE, NOTE_LIST |
| `Ctrl+A` | Save | ENTITY_EDIT, NOTE_EDIT |
| `Ctrl+N` | New note | ENTITY_PAGE |
| `Ctrl+P` | Edit piles | ENTITY_PAGE, NOTE_LIST |
| `Ctrl+T` | Edit tags/ideas | NOTE_LIST |
| `Ctrl+F` | Format text | NOTE_EDIT |
| `Ctrl+S` | Suggest title/ideas | NOTE_EDIT, AUTOCOMPLETE |
| `Ctrl+R` | OCR | NOTE_EDIT |
| `Ctrl+I/J/K` | Image navigation | NOTE_EDIT, NOTE_SELECTED |
| `Enter` | Execute/select/add | Various |
| `Escape` | Close/exit | Various |
| `Backspace` | Go back | SEARCH_BAR, AUTOCOMPLETE |

### Avoiding Conflicts

- **Never use `Ctrl+C`** - conflicts with system copy
- **Never use `Ctrl+V`** - conflicts with system paste
- **Never use `Ctrl+X`** - conflicts with system cut
- **Never use `Ctrl+Z`** - conflicts with system undo
- **Never use `Ctrl+A`** in text inputs without checking context (conflicts with select all)
- Always call `event.preventDefault()` in the KeyboardContext when a shortcut is handled

### Testing Shortcuts

After any shortcut change:
1. Verify the shortcut works in its intended context
2. Verify it doesn't fire in wrong contexts (e.g., when typing in inputs)
3. Verify the help overlay (Ctrl+H) shows the correct information
4. Verify the documentation matches

### Note Selection Limitation

Note selection and editing shortcuts (`Enter` to select, `Ctrl+E/T/P` to edit) **only work in Full view mode**. This is because NoteSlim, NoteGrid, NoteTile, and NoteResult components don't implement selection state. This is documented in KEYBOARD_SHORTCUTS.md.

## Build Commands

```bash
cd site
npm run dev    # Development server
npm run build  # Production build
npm run sass   # Watch SCSS changes
```

## Style Architecture

- `style.scss` - Main styles
- `_variables.scss` - Colors, fonts, CSS variables (supports dark mode)
- `_mixins.scss` - Reusable style patterns
- `_note_full.scss` - Full note view styles
- `_note_slim.scss` - Slim note view styles

The help overlay styles are at the end of `style.scss`.
