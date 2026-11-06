'use strict'

import fs from 'fs'
import https from 'https'
import { parse } from 'csv-parse'
import config from '../config'
import { Readable } from 'stream'
import { guessYearFromUrl } from '../utils/urls'
import * as AuthControllers from '../resources/auth/auth.controllers.js'
import * as WorkControllers from '../resources/work/work.controllers.js'
import * as IdeaControllers from '../resources/idea/idea.controllers.js'
import * as NoteControllers from '../resources/note/note.controllers.js'
import * as PileControllers from '../resources/pile/pile.controllers.js'
import { mintNick, type NickEntityType } from '../resources/nick/nickLifecycle.js'

// What happened to one imported row (#374): the stages it completed
// (parsed, created, nicks, images), the record it made, and the error
// that stopped it, if any. A row can have an id and still not be ok, e.g.
// when the note was made but its images couldn't be downloaded.
export interface RowResult {
  row: number
  ok: boolean
  id?: string
  stages: string[]
  error?: string
}

export interface ImportResult {
  imported: number
  failed: number
  rows: RowResult[]
}

const RECORD_TYPES = 'use 1 (notes), 2 (works) or 3 (Instapaper highlights)'

function parserFor(recordType: number) {
  // Instapaper exports are tab-separated. Quoted fields can hold newlines
  // (#362); relax_quotes keeps a bare " inside an unquoted field from
  // failing the whole import.
  const delimiter = recordType === 3 ? '\t' : ','
  return parse({ delimiter, relax_column_count: true, quote: '"', relax_quotes: true })
}

// Import each row in turn. A failing row is recorded and logged, and the
// rest still run.
async function importRows(input: NodeJS.ReadableStream, recordType: number): Promise<ImportResult> {
  const processor = getProcessor(recordType)
  if (!processor) {
    throw Object.assign(new Error(`Unsupported record type ${recordType}: ${RECORD_TYPES}`), { status: 400 })
  }
  const entries: CsvRow[] = []
  const parser = parserFor(recordType)
  input.pipe(parser).on('data', (data: CsvRow) => { entries.push(data) })
  await streamComplete(parser)

  const rows: RowResult[] = []
  for (const [i, entry] of entries.entries()) {
    const result: RowResult = { row: i + 1, ok: false, stages: [] }
    try {
      await processor(entry, result)
      result.ok = true
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e)
      console.error(`Import row ${result.row} stopped after ${result.stages.at(-1) ?? 'nothing'}: ${result.error}`)
    }
    rows.push(result)
  }
  return { imported: rows.filter((r) => r.ok).length, failed: rows.filter((r) => !r.ok).length, rows }
}

export async function importCSV(filePath: string, recordType: number) {
  console.log('Importing records from file ' + filePath)
  console.log('')
  const { imported, failed, rows } = await importRows(fs.createReadStream(filePath), recordType)
  for (const r of rows.filter((r) => !r.ok)) {
    console.log(`  row ${r.row}: ${r.error} (done: ${r.stages.join(', ') || 'nothing'})`)
  }
  console.log(`Imported records: ${imported}, failed: ${failed}`)
}

export async function importCsvFromString(string: unknown, recordType: number) {
  return importRows(Readable.from(typeof string === 'string' ? string : ''), recordType)
}

// Rejects on a parse error, which ends the stream without an 'end' event
function streamComplete(stream: any) {
  return new Promise<void>(function c(res, rej) {
    stream.on('end', function () {
      res()
    })
    stream.on('error', function (err: unknown) {
      console.error('Import parse error:', err)
      rej(err)
    })
  })
}

// A processor pairs a parser with its matching importer so the type flows
// through correctly per record type. It records its progress on `result`.
type Processor = (row: CsvRow, result: RowResult) => Promise<unknown>

const parsed = <T>(value: T, result: RowResult) => {
  result.stages.push('parsed')
  return value
}

function getProcessor(dataType: number): Processor | null {
  switch (dataType) {
    case 1:
      return (row, result) => importNote(parsed(parseNote(row), result), result)
    case 2:
      return (row, result) => importWork(parsed(parseWork(row), result), result)
    case 3:
      return (row, result) => importInstapaperNote(parsed(parseInstapaper(row), result), result)
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

// Download a URL to a file. Rejects on a network error or a non-200
// response, removing any partial file, instead of resolving as if it had
// worked (#374).
export async function getImageFromURL(url: string | undefined, dest: string) {
  if (!url) throw new Error('No image URL')
  await new Promise<void>((resolve, reject) => {
    const fail = (e: Error) => {
      fs.promises.unlink(dest).catch(() => {})
      reject(e)
    }
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume()
        fail(new Error(`HTTP ${response.statusCode} for ${url}`))
        return
      }
      const file = fs.createWriteStream(dest)
      response.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', fail)
    })
    request.on('error', fail)
  })
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
  authors: string[]
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

// New records get their nicks as they're created (#367). An import also
// reuses existing works, ideas and piles, which may predate nicks, so
// mint any that are missing (#223). Minting an active nick is a no-op.
async function ensureNicks(records: [NickEntityType, unknown][]) {
  await Promise.all(
    records.filter(([, id]) => id).map(([type, id]) => mintNick(type, id))
  )
}

// Download a row's images and attach the ones that arrived. Throws, after
// attaching those, if any failed, so the row is reported incomplete.
async function attachImages(result: RowResult, noteId: string, urls: string[], useAirtableFormat: boolean) {
  const wanted = urls.filter((url) => url && url.trim())
  if (!wanted.length) return
  const settled = await Promise.allSettled(
    wanted.map((url, idx) => downloadImageForNote(noteId, idx + 1, url, useAirtableFormat))
  )
  const saved = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []))
  if (saved.length) await NoteControllers.updateNote(noteId, { images: saved })
  const failed = settled.length - saved.length
  if (failed) throw new Error(`${failed} of ${settled.length} images could not be downloaded`)
  result.stages.push('images')
}

async function importNote(importObject: NoteImportObject, result: RowResult) {
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

  // Year normalization: empty or NaN → null (Number('') is 0, #349), and
  // prefer URL inference when present
  const rawYear = typeof importObject.year === 'string'
    ? importObject.year.trim()
    : importObject.year
  const yearAsNumber = rawYear === '' || rawYear === null ? NaN : Number(rawYear)
  let year: number | null = Number.isFinite(yearAsNumber) ? yearAsNumber : null
  if (importObject.url) {
    year = guessYearFromUrl(importObject.url) ?? year
  }

  const newNote: NewNoteFields = {
    authors: author?._id ? [String(author._id)] : [],
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
  result.id = String(createdNote._id)
  result.stages.push('created')
  await ensureNicks([
    ['note', createdNote._id],
    ['work', work?._id],
    ...ideas.map((i): [NickEntityType, unknown] => ['idea', i?._id]),
    ...piles.map((p): [NickEntityType, unknown] => ['pile', p?._id]),
  ])
  result.stages.push('nicks')
  await attachImages(result, result.id, importObject.externalImageUrls, true)
}

async function importInstapaperNote(importObject: NoteImportObject, result: RowResult) {
  const [author, work] = await Promise.all([
    AuthControllers.findOrCreateAuthor(importObject.authorName),
    WorkControllers.findOrCreateWork(importObject.workName),
  ])

  const newNote: NewNoteFields = {
    authors: author?._id ? [String(author._id)] : [],
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
  result.id = String(createdNote._id)
  result.stages.push('created')
  await ensureNicks([
    ['note', createdNote._id],
    ['work', work?._id],
  ])
  result.stages.push('nicks')
  await attachImages(result, result.id, importObject.externalImageUrls, false)
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
  authors: string[]
  year?: number
  url?: string
  piles: string[]
}

async function importWork(importObject: WorkImportObject, result: RowResult) {
  if (!importObject.title) throw new Error('No work title')

  const pilePromises = importObject.piles
    .filter(Boolean)
    .map((pile) => PileControllers.findOrCreatePile(pile))

  const author = await AuthControllers.findOrCreateAuthor(importObject.authorName)
  const updateObject: WorkUpdateFields = {
    authors: author?._id ? [String(author._id)] : [],
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
  if (!work) throw new Error('Could not create the work')
  await WorkControllers.updateWorkInfo(String(work._id), updateObject)
  result.id = String(work._id)
  result.stages.push('created')
  await ensureNicks([
    ['work', work._id],
    ...piles.map((p): [NickEntityType, unknown] => ['pile', p?._id]),
  ])
  result.stages.push('nicks')
}
