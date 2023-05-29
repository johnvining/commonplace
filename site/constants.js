export const view_modes = {
  FULL: 1,
  SLIM: 2,
  GRID: 3,
  RESULT: 4,
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
  EDIT_PILES: 'Editing Piles',
}

export const modifiers = {
  auth: 'auth',
  find: 'find',
  help: 'help',
  home: 'home',
  idea: 'idea',
  list: 'list',
  note: 'note',
  pile: 'pile',
  work: 'work',
  flip: 'flip',
  file: 'file',
  slim: 'slim',
  grid: 'grid',
  full: 'full',
}

export const keyCodes = {
  delete: 8,
  new: 78, // n
  esc: 27, // escape
  format: 70, // f
  save: 83, // s
  accept: 65, // a
  edit: 69, // e
  ideas: 84, // t (tags)
  piles: 80, // p
  enter: 13, //enter
  open: 79, // o
  full: 50, // 2
  slim: 51, // 3
  grid: 52, // 4
}
