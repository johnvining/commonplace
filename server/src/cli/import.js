'use strict'

import fs from 'fs'
import https from 'https'
import parse from 'csv-parse'
import config from '../config'
import * as AuthControllers from '../resources/auth/auth.controllers.js'
import * as WorkControllers from '../resources/work/work.controllers.js'
import * as IdeaControllers from '../resources/idea/idea.controllers.js'
import * as NoteControllers from '../resources/note/note.controllers.js'
import * as PileControllers from '../resources/pile/pile.controllers.js'

export async function importNoteCSV(filePath, recordType) {
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
  const parseFunc = getParseFunction(recordType)
  const importFunc = getImportFunction(recordType)

  for (let i = 0; i < entries.length; i++) {
    let parsedObject = parseFunc(entries[i])
    await importFunc(parsedObject)
    totalImports++
  }

  console.log('Imported records: ' + totalImports)
}

function streamComplete(stream) {
  return new Promise(function c(res) {
    stream.on('end', function() {
      res()
    })
  })
}

function getParseFunction(dataType) {
  switch (dataType) {
    case 1:
      return parseNote
    case 2:
      return parseWork
  }
  return null
}

function getImportFunction(dataType) {
  switch (dataType) {
    case 1:
      return importNote
    case 2:
      return importWork
  }
  return null
}

function parseNote(csvLine) {
  var obj = {}
  obj.authorName = csvLine[0]
  obj.title = csvLine[1]
  obj.text = csvLine[2]
  obj.workName = csvLine[3]
  obj.url = csvLine[4]
  obj.ideas = csvLine[5]?.split(',')
  obj.externalImageUrls = csvLine[6]?.split(',')
  obj.piles = csvLine[7]?.split(',')
  // TODO: Year
  return obj
}

export async function getImageFromURL(url, dest) {
  var file = fs.createWriteStream(dest)

  // TODO: Error handling
  let htPromise = new Promise((resolve, reject) => {
    https.get(url, function(response) {
      response.pipe(file)
      file.on('finish', function() {
        file.close()
        resolve()
      })
    })
  })

  await htPromise
}

async function createDirIfNeeded(path, cb) {
  let mask = 484 // https://chmodcommand.com/chmod-744/
  fs.mkdir(path, mask, function(err) {
    if (err) {
      if (err.code == 'EEXIST') cb(null)
      else cb(err)
    } else cb(null)
  })
}

export async function downloadImageForNote(noteId, imageN, imageUrl, cb) {
  const fileName = imageUrl?.split('/').pop()
  // TODO: Check this matches
  // TODO: Switch on http/s
  var dest = noteId + '/' + imageN + '-' + fileName
  await createDirIfNeeded(config.imageStorePath + '/' + noteId, val => {
    if (val) console.error(val)
  })
  await getImageFromURL(imageUrl, config.imageStorePath + '/' + dest)
  return dest
}

async function importNote(importObject) {
  let authorPromise = AuthControllers.findOrCreateAuthor(
    importObject.authorName
  )

  let workPromise = WorkControllers.findOrCreateWork(importObject.workName)

  var ideaPromises = []
  importObject.ideas.map(idea => {
    ideaPromises.push(IdeaControllers.findOrCreateIdea(idea))
  })

  var pilePromises = []
  importObject.piles.map(pile => {
    console.log(pile)
    pilePromises.push(PileControllers.findOrCreatePile(pile))
  })

  let dataPromise = Promise.all([authorPromise, workPromise])
  let ideaPromise = Promise.all(ideaPromises)
  let pilePromise = Promise.all(pilePromises)
  let response = await Promise.all([dataPromise, ideaPromise, pilePromise])

  let newNote = {
    author: response[0][0]?._id,
    work: response[0][1]?._id,
    ideas: response[1].filter(x => x),
    piles: response[2].filter(x => x),
    text: importObject.text,
    title: importObject.title,
    url: importObject.url
  }

  let createdNote = await NoteControllers.createNoteObj(newNote)

  // Add Images
  let imagePromises = []
  for (let i = 0; i < importObject.externalImageUrls.length; i++) {
    imagePromises.push(
      downloadImageForNote(
        createdNote._id,
        i + 1,
        importObject.externalImageUrls[i]
      )
    )
  }

  let imagePromiseResp = await Promise.all(imagePromises)
  await NoteControllers.updateNote(createdNote._id, {
    images: imagePromiseResp
  })
}

function parseWork(csvLine) {
  var obj = {}
  obj.title = csvLine[0]
  obj.authorName = csvLine[1]
  obj.year = csvLine[2]
  obj.url = csvLine[3]
  // TODO: obj.ideas = csvLine[4].split(',')
  return obj
}

async function importWork(importObject) {
  if (!importObject.title) return

  let work = await WorkControllers.findOrCreateWork(importObject.title)

  // TODO: Support different update behaviors: Overwrite,Clear,FillIn
  let updateObject = {}
  updateObject.author = await AuthControllers.findOrCreateAuthor(
    importObject.authorName
  )
  if (importObject.year && !isNaN(updateObject.year)) {
    updateObject.year = importObject.year // TODO: Support URL guessing
  }
  if (importObject.url) {
    updateObject.url = importObject.url
  }

  await WorkControllers.updateWorkInfo(work._id, updateObject)
}
