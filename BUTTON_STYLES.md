## Button Styles

Canonical button styles to keep UI consistent:

- `button` (default)
  - Base class for all buttons.
  - Text buttons for toolbars, dialogs, and primary actions.
  - Use `TopLevelStandardButton` when possible.
- `action-button`
  - Icon-only buttons in note action bars and compact controls.
  - Use alongside the base `button` class.
- `grid-button`
  - Small icon toggle in grid/list selections.
  - Use alongside the base `button` class.
- `pin-button`
  - Star/pin controls (handled by `PinButton`).
- `pin-button-icon-only`
  - Icon-only pin buttons with minimal padding and no border.
- `clickable-label-button`
  - Inline label-like buttons.

If you add a new button, default to the standard style (`TopLevelStandardButton`
or `standard-button`) unless you intentionally need an icon or grid toggle.
