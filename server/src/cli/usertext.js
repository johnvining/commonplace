export const yes = 'yes'
export const no = 'no'

export const prompt = 'c]'
export const prompt_edit = 'edit?]'
export const prompt_done = 'done?]'

export const unknown_command = 'Unknown command.'
export const no_note_selected = 'Please select a note.'
export const no_text = 'No text.'

export const prompts = {
  author: {
    prompt: 'auth?]',
    none_found: 'No authors found.'
  },
  idea: {
    prompt: 'idea?]',
    none_found: 'No ideas found.'
  },
  note: {
    prompt: 'note?]',
    none_found: 'No notes found.'
  }
}

export const command = {
  auth: 'auth',
  help: 'help',
  idea: 'idea',
  last: 'last',
  list: 'list',
  load: 'load',
  note: 'note',
  quit: 'quit',
  text: 'text',
  wipe: 'wipe'
}

// A subset of the above can be contexts
export const context = {
  auth: 'auth',
  idea: 'idea',
  note: 'note'
}

export const helpText = {
  auth: 'e.g.: auth john -> find all authors with John in the name',
  help:
    'displays discriptions of all commands. argument is a command you want help on.',
  idea: 'idea',
  last: "display the last ten notes you've looked at",
  list: 'list information for a given author or work. no arguments.',
  note:
    'create a new note, using the given author if one is selected. argument is the title.',
  quit: 'quit the program.',
  text: 'display the text of a note',
  wipe: 'wipe'
}
