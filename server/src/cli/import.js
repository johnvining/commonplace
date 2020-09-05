#!/usr/bin/env node
'use strict'

import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'
import parse from 'csv-parse'
import * as AuthControllers from '../resources/auth/auth.controllers.js'
import * as WorkControllers from '../resources/work/work.controllers.js'
import * as IdeaControllers from '../resources/idea/idea.controllers.js'
import * as NoteControllers from '../resources/note/note.controllers.js'

var database

// var args = require('minimist')(process.argv.slice(2), {
//   string: ['file']
// })

// const BASEPATH = path.resolve(process.env.BASEPATH || __dirname)

var parser = parse({ delimiter: ',' }, async function(err, data) {
  for (let i = 0; i < data.length; i++) {
    let importObject = parseIntoObject(data[i])
    await saveImportObjectToDatabase(importObject)
  }
})

function parseIntoObject(csvLine) {
  var obj = {}
  obj.authorName = csvLine[0]
  obj.title = csvLine[1]
  obj.text = csvLine[2]
  obj.workName = csvLine[3]
  obj.ideas = csvLine[4].split(',')
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

  let dataPromise = Promise.all([authorPromise, workPromise])
  let ideaPromise = Promise.all(ideaPromises)
  Promise.all([dataPromise, ideaPromise])
    .then(async function(response) {
      // TODO: Write note to database
      let newNote = {
        author: response[0][0]?._id,
        work: response[0][1]?._id,
        ideas: response[1].filter(x => x),
        text: importObject.text,
        title: importObject.title
      }

      await NoteControllers.createNoteObj(newNote)
    })
    .catch(err => console.log(err))
}

const connect = () => {
  return mongoose.connect('mongodb://localhost:27017/whatever', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
  })
}

console.log('Starting database connection...')

connect().then(async connection => {
  database = connection
  fs.createReadStream(
    '/Users/johnvining/Documents/GitHub/commonplace/server/csvin.csv'
  ).pipe(parser)
})

// if (args.help || process.argv.length <= 2) {
//   console.log('wrong params')
// } else if (args.file) {
//   console.log('Importing from ' + args.file + '...')

//   let filePath = path.join(BASEPATH, args.file)
//   fs.readFile(filePath, function(err, contents) {
//     if (err) console.log(err.toString())
//     else processCSV(contents.toString())
//   })
// }

// // TODO: Streamify
// function processCSV(text) {
//   text = text.toUpperCase()
//   process.stdout.write(text)
// }
