'use strict'

import fs from 'fs'
import https from 'https'
import { parse } from 'csv-parse'
import config from '../config'
import Readable from 'stream'
import { guessYearFromUrl } from '../utils/urls'
import * as AuthControllers from '../resources/auth/auth.controllers.js'
import * as WorkControllers from '../resources/work/work.controllers.js'
import * as IdeaControllers from '../resources/idea/idea.controllers.js'
import * as NoteControllers from '../resources/note/note.controllers.js'
import * as PileControllers from '../resources/pile/pile.controllers.js'

export async function importCSV(filePath: string, recordType: number) {
  console.log('Importing records from file ' + filePath)
  console.log('')

  const entries: any[] = []
  const parser = parse({ delimiter: ',' })
  fs.createReadStream(filePath)
    .pipe(parser)
    .on('data', async (data) => {
      entries.push(data)
    })

  await streamComplete(parser)

  let totalImports = 0
  const processor = getProcessor(recordType)
  if (!processor) {
    console.error('Unsupported record type', recordType)
    return
  }

  for (const entry of entries) {
    await processor(entry)
    totalImports++
  }

  console.log('Imported records: ' + totalImports)
}

export async function importCsvFromString(string: string, recordType: number) {
  if (recordType != 1 && recordType != 3) {
    return null // Unsupported
  }

  const Readable = require('stream').Readable
  const stream = Readable.from(string)
  const entries: any[] = []
  const delimiter = recordType === 3 ? '\t' : ','
  const quote = recordType === 3 ? false : '"'
  const parser = parse({ delimiter, relax_column_count: true, quote })
  stream.pipe(parser).on('data', async (data: any) => {
    entries.push(data)
  }).on('error', (err: unknown) => {
    console.error('Import parse error:', err)
  })
  await streamComplete(parser)

  let totalImports = 0
  const processor = getProcessor(recordType)
  if (!processor) return null

  for (const entry of entries) {
    await processor(entry)
    totalImports++
  }

  return totalImports
}

function streamComplete(stream: any) {
  return new Promise<void>(function c(res) {
    stream.on('end', function () {
      res()
    })
  })
}

// A processor pairs a parser with its matching importer so the type flows
// through correctly per record type.
type Processor = (row: CsvRow) => Promise<unknown>

function getProcessor(dataType: number): Processor | null {
  switch (dataType) {
    case 1:
      return (row) => importNote(parseNote(row))
    case 2:
      return (row) => importWork(parseWork(row))
    case 3:
      return (row) => importInstapaperNote(parseInstapaper(row))
  }
  return null
}

// Shape produced by parseNote / parseInstapaper and consumed by importNote /
// importInstapaperNote. `year` is whatever was in the CSV cell — string,
// numeric string, or null — and gets normalized inside the importers.
interface NoteImportObject {
  authorName: string
  title: string
  text: string
  workName: string
  url: string
  ideas: string[]
  externalImageUrls: string[]
  piles: string[]
  year: string | number | null
  page: string
  take: string
}

interface WorkImportObject {
  title: string
  authorName: string
  year: string | number | null
  url: string
  piles: string[]
}

type CsvRow = string[]

function parseNote(csvLine: CsvRow): NoteImportObject {
  return {
    authorName: csvLine[0],
    title: csvLine[1],
    text: csvLine[2],
    workName: csvLine[3],
    url: csvLine[4],
    ideas: csvLine[5]?.split(',') ?? [],
    externalImageUrls: csvLine[6]?.split(',') ?? [],
    piles: csvLine[7]?.split(',') ?? [],
    year: csvLine[8] ?? null,
    page: csvLine[9],
    take: csvLine[10],
  }
}

// Columns from IFTTT Instapaper → Google Sheets: Article, Text, Note Url, Image Url, Title
function parseInstapaper(tsvLine: CsvRow): NoteImportObject {
  return {
    workName: tsvLine[0],
    text: tsvLine[1],
    url: tsvLine[2],
    externalImageUrls: tsvLine[3] ? [tsvLine[3]] : [''],
    title: tsvLine[4],
    authorName: '',
    ideas: [''],
    piles: [''],
    year: null,
    page: '',
    take: '',
  }
}

export async function getImageFromURL(url: string | undefined, dest: string) {
  if (!url) return

  var file = fs.createWriteStream(dest)
  let htPromise = new Promise<void>((resolve, reject) => {
    try {
      https.get(url, function (response) {
        response.pipe(file)
        file.on('finish', function () {
          file.close()
          resolve()
        })

        file.on('error', function (err) {
          resolve()
          console.error(err)
        })
      })
    } catch (e) {
      resolve()
      console.error(e)
    }
  })

  try {
    await htPromise
  } catch (e) {
    console.error(e)
  }

  return dest
}

async function createDirIfNeeded(path: string) {
  const mask = 484 // https://chmodcommand.com/chmod-744/
  return mkDirPromise(path, mask)
}

function mkDirPromise(path: string, mask: number) {
  return new Promise<string>(function (resolve, reject) {
    fs.mkdir(path, mask, function (err) {
      if (err && err.code !== 'EEXIST') return reject(err)
      resolve(path)
    })
  })
}

export async function downloadImageForNote(
  noteId: string,
  imageN: number,
  imageUrl: string,
  useAirtableFormat = false
) {
  // airtable format: "filename.jpg (url/to/file.jpg)"
  if (useAirtableFormat) {
    imageUrl = imageUrl.substring(
      imageUrl.indexOf('(') + 1,
      imageUrl.lastIndexOf(')')
    )
  }

  const fileName = imageUrl?.split('/').pop()
  // TODO: Switch on http/s
  const dest = noteId + '/' + imageN + '-' + fileName
  await createDirIfNeeded(config.imageStorePath + '/' + noteId)
  await getImageFromURL(imageUrl, config.imageStorePath + '/' + dest)
  return dest
}

interface NewNoteFields {
  author?: string
  work?: string
  ideas: string[]
  piles: string[]
  text: string
  title: string
  url: string
  year: number | null
  page: string
  take: string
}

async function importNote(importObject: NoteImportObject) {
  const [author, work] = await Promise.all([
    AuthControllers.findOrCreateAuthor(importObject.authorName),
    WorkControllers.findOrCreateWork(importObject.workName),
  ])
  const ideas = await Promise.all(
    importObject.ideas.map((idea) => IdeaControllers.findOrCreateIdea(idea))
  )
  const piles = await Promise.all(
    importObject.piles.map((pile) => PileControllers.findOrCreatePile(pile))
  )

  // Year normalization: NaN → null, otherwise prefer URL inference when present
  const yearAsNumber = typeof importObject.year === 'number'
    ? importObject.year
    : Number(importObject.year)
  let year: number | null = Number.isFinite(yearAsNumber) ? yearAsNumber : null
  if (year !== null && importObject.url) {
    year = guessYearFromUrl(importObject.url) ?? year
  }

  const newNote: NewNoteFields = {
    author: author?._id ? String(author._id) : undefined,
    work: work?._id ? String(work._id) : undefined,
    ideas: ideas.filter((x): x is NonNullable<typeof x> => Boolean(x)).map((i) => String(i._id)),
    piles: piles.filter((x): x is NonNullable<typeof x> => Boolean(x)).map((p) => String(p._id)),
    text: importObject.text,
    title: importObject.title,
    url: importObject.url,
    year,
    page: importObject.page,
    take: importObject.take,
  }

  const createdNote = await NoteControllers.createNoteObj(newNote)

  if (
    importObject.externalImageUrls.length == 1 &&
    importObject.externalImageUrls[0] == ''
  ) {
    return
  }

  const imagePromises = importObject.externalImageUrls.map((url, idx) =>
    downloadImageForNote(String(createdNote._id), idx + 1, url, true)
  )

  const imagePromiseResp = await Promise.all(imagePromises)
  await NoteControllers.updateNote(createdNote._id, {
    images: imagePromiseResp,
  })
}

async function importInstapaperNote(importObject: NoteImportObject) {
  const [author, work] = await Promise.all([
    AuthControllers.findOrCreateAuthor(importObject.authorName),
    WorkControllers.findOrCreateWork(importObject.workName),
  ])

  const newNote: NewNoteFields = {
    author: author?._id ? String(author._id) : undefined,
    work: work?._id ? String(work._id) : undefined,
    ideas: [],
    piles: [],
    text: importObject.text,
    title: importObject.title,
    url: importObject.url,
    year: importObject.url ? guessYearFromUrl(importObject.url) : null,
    page: '',
    take: '',
  }

  const createdNote = await NoteControllers.createNoteObj(newNote)

  if (
    importObject.externalImageUrls.length == 1 &&
    importObject.externalImageUrls[0] == ''
  ) {
    return
  }

  const imagePromises = importObject.externalImageUrls.map((url, idx) =>
    downloadImageForNote(String(createdNote._id), idx + 1, url, false)
  )

  const imagePromiseResp = await Promise.all(imagePromises)
  await NoteControllers.updateNote(createdNote._id, {
    images: imagePromiseResp,
  })
}

function parseWork(csvLine: CsvRow): WorkImportObject {
  return {
    title: csvLine[0],
    authorName: csvLine[1],
    year: csvLine[2] ?? null,
    url: csvLine[3],
    piles: csvLine[4]?.split(',') ?? [],
  }
}

interface WorkUpdateFields {
  author?: string
  year?: number
  url?: string
  piles: string[]
}

async function importWork(importObject: WorkImportObject) {
  if (!importObject.title) return

  const pilePromises = importObject.piles
    .filter(Boolean)
    .map((pile) => PileControllers.findOrCreatePile(pile))

  const author = await AuthControllers.findOrCreateAuthor(importObject.authorName)
  const updateObject: WorkUpdateFields = {
    author: author?._id ? String(author._id) : undefined,
    piles: [],
  }

  if (importObject.year) {
    const yearNum = Number(importObject.year)
    if (Number.isFinite(yearNum)) {
      updateObject.year = yearNum
    }
  } else if (importObject.url) {
    const inferred = guessYearFromUrl(importObject.url)
    if (inferred !== null) updateObject.year = inferred
  }

  if (importObject.url) {
    updateObject.url = importObject.url
  }

  const piles = await Promise.all(pilePromises)
  for (const pile of piles) {
    if (pile?._id) updateObject.piles.push(String(pile._id))
  }

  const work = await WorkControllers.findOrCreateWork(importObject.title)
  if (!work) return
  await WorkControllers.updateWorkInfo(String(work._id), updateObject)
}
