'use strict'

import fs from 'fs'
import parse from 'csv-parse'
import * as AuthControllers from '../resources/auth/auth.controllers.js'
import * as WorkControllers from '../resources/work/work.controllers.js'
import * as IdeaControllers from '../resources/idea/idea.controllers.js'
import * as NoteControllers from '../resources/note/note.controllers.js'

export async function importNoteCSV(filePath) {
  console.log('Importing notes from file ' + filePath)
  console.log('')

  var entries = []
  var parser = parse({ delimiter: ',' })
  fs.createReadStream(filePath)
    .pipe(parser)
    .on('data', async data => {
      entries.push(data)
    })

  await streamComplete(parser)

  var totalImports = 0
  for (let i = 0; i < entries.length; i++) {
    let parsedObject = parseIntoObject(entries[i])
    await saveImportObjectToDatabase(parsedObject)
    totalImports++
  }

  console.log('Imported notes: ' + totalImports)
}

function streamComplete(stream) {
  return new Promise(function c(res) {
    stream.on('end', function() {
      res()
    })
  })
}

function parseIntoObject(csvLine) {
  var obj = {}
  obj.authorName = csvLine[0]
  obj.title = csvLine[1]
  obj.text = csvLine[2]
  obj.workName = csvLine[3]
  obj.url = csvLine[4]
  obj.ideas = csvLine[5].split(',')
  return obj
}

async function saveImportObjectToDatabase(importObject) {
  let authorPromise = AuthControllers.findOrCreateAuthor(
    importObject.authorName
  )

  let workPromise = WorkControllers.findOrCreateWork(importObject.workName)

  var ideaPromises = []
  for (let i = 0; i < importObject.ideas.length; i++) {
    let ideaPromise = IdeaControllers.findOrCreateIdea(importObject.ideas[i])
    ideaPromises.push(ideaPromise)
  }

  // TODO: Fix awaiting here
  let dataPromise = Promise.all([authorPromise, workPromise])
  let ideaPromise = Promise.all(ideaPromises)
  await Promise.all([dataPromise, ideaPromise])
    .then(async function(response) {
      let newNote = {
        author: response[0][0]?._id,
        work: response[0][1]?._id,
        ideas: response[1].filter(x => x),
        text: importObject.text,
        title: importObject.title,
        url: importObject.url
      }

      await NoteControllers.createNoteObj(newNote)
    })
    .catch(err => console.log(err))
}
