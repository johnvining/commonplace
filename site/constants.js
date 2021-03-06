export const view_modes = {
  FULL: 1,
  SLIM: 2,
  GRID: 3,
  RESULT: 4
}

// No selection: No specific note is selected
// Not selected: This specific note is not the one selected (and there is one selected)
// Selected: This note is selected. Tabbing should be limited to this note.
// Edit: This note is being edited.
// Edit Ideas: This note is in the mode of editing ideas
// Edit Piles: Ditto piles
export const note_modes = {
  NO_SELECTION: 'No selection',
  NOT_SELECTED: 'Not selected',
  SELECTED: 'Selected',
  EDIT: 'Editing',
  EDIT_IDEAS: 'Editing Ideas',
  EDIT_PILES: 'Editing Piles'
}
