import promptFunc from 'prompt-sync'
const prompt = promptFunc()
import mongoose from 'mongoose'
import * as usertext from './usertext.js'
import path from 'path'
import * as AuthControllers from '../resources/auth/auth.controllers.js'
import * as NoteControllers from '../resources/note/note.controllers.js'
import * as IdeaControllers from '../resources/idea/idea.controllers.js'
import * as importUtils from './import.js'
import config from '../config'

var context = {
  type: null,
  item: null
}

var oldContext = {
  type: null,
  item: null
}

// TODO move database functions to separate file
// TODO implement last

const connect = () => {
  return mongoose.connect(config.dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
  })
}

connect()
  .then(async connection => {
    let go = true
    while (go) {
      console.log(writeContext())

      let entry = prompt(usertext.prompt + ' ')
      let command = entry.split(' ')[0]

      var args
      if (entry.indexOf(' ') != -1) {
        args = entry.substr(entry.indexOf(' ') + 1)
      } else {
        args = ''
      }

      switch (command) {
        case usertext.command.auth:
          await auth(args)
          break
        case usertext.command.idea:
          await idea(args)
          break
        case usertext.command.last:
          await last()
          break
        case usertext.command.load:
          await load()
          break
        case usertext.command.list:
          await doList()
          break
        case usertext.command.note:
          await note(args)
          break
        case usertext.command.help:
          help(args)
          break
        case usertext.command.wipe:
          oldContext.type = context.type
          oldContext.item = context.item
          context.type = null
          context.item = null
          break
        case '=':
          context.type = oldContext.type
          context.item = oldContext.item
          break
        case '':
          break
        case usertext.quit:
          process.exit()
        default:
          console.log(usertext.unknown_command)
      }
    }
  })
  .catch(e => console.error(e))

function writeContext() {
  let context_string = ''
  switch (
    context.type // TODO: Shouldn't refer to usertext probs
  ) {
    case usertext.context.auth:
      context_string =
        '[' + usertext.context.auth + ' ' + context.item.name + ']'
      break
    case usertext.context.note:
      context_string =
        '[' + usertext.context.note + ' ' + context.item.title + ']'
      break
    case usertext.context.idea:
      context_string =
        '[' + usertext.context.idea + ' ' + context.item.name + ']'
      break
    default:
      context_string = '[]'
  }

  return context_string
}

}

async function doList() {
  let recent_notes = await NoteControllers.getTenMostRecentNotes()
}

async function note(args) {
  if (context.type == usertext.context.auth) {
    let note = await NoteControllers.createNote(args, context.item)
    setContext(usertext.context.note, note)
  } else {
    let note = await NoteControllers.createNote(args)
    setContext(usertext.context.note, note)
    let author = await auth(args)
    await NoteControllers.addAuthor(note.id, author)
  }
}

async function searchOrCreate(prompts, searchStr, search, create) {
  const searchList = await search(searchStr)

  if (searchList.length == 0) {
    console.log(prompts.none_found)
    let choice = prompt('new? ')
    if (choice == 'yes') {
      let name = prompt('name?] ')
      return await create(name)
    }
  } else {
    for (let i = 0; i < searchList.length; i++) {
      console.log(' ' + (i + 1) + '] ' + searchList[i].name)
    }

    let choice = prompt('?] ')
    if (choice == 'new') {
      let name = prompt('name?] ')
      return await create(name)
    }

    if (choice == '' || choice > searchList.length) {
      console.log(' Invalid choice')
      return
    }

    return searchList[choice - 1]
  }
}

async function auth(input) {
  let author = await searchOrCreate(
    usertext.prompts.author,
    input,
    AuthControllers.findAuthorsByString,
    AuthControllers.createAuthor
  )

  if (author != null) {
    setContext(usertext.context.auth, author)
  }

  return author
}

async function last() {
  let last_notes = await database.getTenMostRecentNotes()
  for (i = 0; i < last_notes.length; i++) {
    console.log(last_notes[i].title)
  }
}

async function load() {
  var mode = 'csv'
  if ((mode = 'csv')) {
    console.log(' ] 1. Notes, 2. Works')
    let recordType = +prompt('?] ')
    if (recordType > 3 || recordType <= 0 || recordType === NaN) {
      return
    }

    printLoadHelp(recordType)
    let filePath = getFilePath()
    await importUtils.importNoteCSV(filePath, recordType)
  }
}

function printLoadHelp(recordType) {
  if (recordType == 1)
    console.log(
      ' format -> Author,Title,Text,Work,URL,"idea1,idea2",image URL,"pile1,pile2",year,page,take'
    )
  else if (recordType == 2)
    console.log(' format -> Title,Author,Year,URL,"pile1,pile2"')
}

function getFilePath() {
  const BASEPATH = path.resolve(process.env.BASEPATH || __dirname)

  let filePath = prompt('file?] ')
  return path.resolve(BASEPATH, filePath)
}

async function idea(input) {
  // TODO Move database ops to separate file
  let idea = await searchOrCreate(
    usertext.prompts.idea,
    input,
    IdeaControllers.findIdeasByString,
    IdeaControllers.createIdea
  )

  if (idea === null) {
    console.log('IDEA NULL')
    return null
  }

  if (context.type == 'note') {
    // TODO: Add the idea to the note
    await NoteControllers.addIdeaToID(context.item._id, idea._id)
  } else {
    setContext(usertext.context.idea, idea)
  }

  return idea
}

async function list() {
  const Note = mongoose.model('note', schemata.note)
  console.log('Searching for notes from ' + context.item.name)

  const notes = await Note.find({ author: context.author._id }).exec()
  if (notes.length == 0) {
    console.log(' No notes found')
    return
  }

  for (i = 0; i < notes.length; i++) {
    console.log(' ' + (i + 1) + '] ' + notes[i].title)
  }

  let authChoice = prompt('?] ')
  if (authChoice == 'del') {
    let which = prompt('note?]')
    await Note.findOneAndDelete({ _id: notes[which - 1]._id })
  }

  if (authChoice == '' || authChoice > notes.length) {
    console.log(' Invalid choice')
    return
  }

  context.note = notes[authChoice - 1]
}

function help(args) {
  if (args != '') {
    console.log(usertext.helpText[args])
  } else {
    Object.keys(usertext.helpText).forEach((command, index) => {
      console.log(' | ' + command + ': ' + usertext.helpText[command])
    })
  }
}

function setContext(type, item) {
  context.type = type
  context.item = item
}
