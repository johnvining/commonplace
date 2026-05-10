import Note from './note.model.js'
import { Auth } from '../auth/auth.model.js'
import Pile from '../pile/pile.model.js'
import Idea from '../idea/idea.model.js'
import Work from '../work/work.model.js'
import Nick from '../nick/nick.model.js'
import { importCsvFromString } from '../../cli/import.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import * as IdeaControllers from '../idea/idea.controllers.js'
import * as WorkControllers from '../work/work.controllers.js'
import {
  getSuggestedIdeas,
  getSuggestedTitle,
  getOpenAiOCR,
} from '../../utils/suggestions.js'
import config from '../../config'
import fs from 'fs'
import { guessYearFromUrl } from '../../utils/urls.js'
import { embedNoteIfStale, generateEmbedding, cosineSimilarity } from '../../utils/embeddings.js'
import { getEmbeddingCache, invalidateEmbedding, upsertEmbedding } from '../../utils/embeddingCache.js'
import { generateNick } from '../nick/nick.controllers.js'
import type { Request, Response } from 'express'


const pageSize = 40

// Fields that are large and not needed in list views
const LIST_OMIT = '-embedding -ocrText -embeddingHash'

// Lean note + runtime augmentations added across the request pipeline:
// `nick` from a Nick lookup, `score`/`_hybridScore`/`_semantic` from search
// rankers. Fields like author/ideas/piles/work may be ObjectIds or populated
// objects depending on the call.
type PopulatedNote = Record<string, unknown> & {
  _id: any
  nick?: string | null
  score?: number
  _hybridScore?: number
  _semantic?: boolean
}

export const reqFindNotesByString = async (req: Request, res: Response) => {
  const escaped = req.body.searchString.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const notes = (await Note.find(
    { $text: { $search: escaped } },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .select(LIST_OMIT)
    .populate('author')
    .populate('ideas')
    .populate('piles')
    .populate({ path: 'work', populate: { path: 'author' } })
    .lean()
    .exec()) as PopulatedNote[]

  const noteIds = notes.map((n) => n._id)
  const nicks = await Nick.find({ note: { $in: noteIds } }).lean().exec()
  const nickMap: Record<string, string> = {}
  nicks.forEach((nick) => {
    if (nick.note && nick.key) nickMap[String(nick.note)] = nick.key
  })
  notes.forEach((note) => { note.nick = nickMap[String(note._id)] || null })
  return notes
}

export const reqGetNoteDetails = async (req: Request, res: Response) => {
  return await findNotesAndPopulate({ _id: req.params.id }, null, false, null, null, null)
}

export const reqDeleteNote = async (req: Request, res: Response) => {
  const id = req.params.id
  const note = await Note.findOne({ _id: id }).lean()
  if (note?.images?.length) {
    await Promise.allSettled(
      note.images.map((img) => fs.promises.unlink(config.imageStorePath + '/' + img))
    )
  }
  await Note.deleteOne({ _id: id })
  invalidateEmbedding(id)
  res.status(200).end()
}

export const reqGetRecentNotes = async (req: Request, res: Response) => {
  return findNotesAndPopulate(
    {},
    { updatedAt: -1 },
    false,
    (Number(req.params.skip) - 1) * pageSize,
    pageSize
  )
}

export const reqGetEarliestNotesToFile = async (req: Request, res: Response) => {
  // TODO: Faster way to do this? -- size: 0 may be slow
  return findNotesAndPopulate(
    { ideas: { $size: 0 } },
    { updatedAt: 1 },
    false,
    (Number(req.params.skip) - 1) * pageSize,
    pageSize
  )
}

export const reqGetRandomNotes = async (req: Request, res: Response) => {
  return findRandomNotesAndPopulate({}, pageSize)
}

export const reqAddIdea = async (req: Request, res: Response) => {
  const doc = await updateNote(req.params.id, { $addToSet: { ideas: req.body.id } })
  await touchIdea(req.body.id)
  return doc
}

export const reqAddNewIdea = async (req: Request, res: Response) => {
  const newIdea = await IdeaControllers.createIdea(req.body.name)
  const doc = await updateNote(req.params.id, { $addToSet: { ideas: newIdea._id } })
  await touchIdea(newIdea._id)
  return doc
}

export const removeIdeaFromNote = async (noteId: any, ideaId: any) => {
  const doc = await updateNote(noteId, { $pull: { ideas: ideaId } })
  await touchIdea(ideaId)
  return doc
}

export const reqRemoveIdeaFromNote = async (req: Request, res: Response) => {
  return removeIdeaFromNote(req.params.id, req.params.ideaId)
}

export const reqAddPile = async (req: Request, res: Response) => {
  const doc = await updateNote(req.params.id, { $addToSet: { piles: req.body.id } })
  await touchPile(req.body.id)
  return doc
}

export const reqAddNewPile = async (req: Request, res: Response) => {
  const newPile = await Pile.create({ name: req.body.name })
  const doc = await updateNote(req.params.id, { $addToSet: { piles: newPile._id } })
  await touchPile(newPile._id)
  return doc
}

export const reqRemovePileFromNote = async (req: Request, res: Response) => {
  const doc = await updateNote(req.params.id, { $pull: { piles: req.params.pileId } })
  if (!doc) {
    return res.status(400).end()
  }
  await touchPile(req.params.pileId)
  return doc
}

export const reqAddWork = async (req: Request, res: Response) => {
  return await updateNote(req.params.id, { work: req.body.newWork })
}

export const reqAddNewWork = async (req: Request, res: Response) => {
  const newWork = await WorkControllers.createWork(req.body.newWork)
  return await updateNote(req.params.id, { work: newWork._id })
}

const inferWorkUrl = async function (workId: unknown, noteUrl: string) {
  if (!workId) return
  const work = await Work.findById(workId).lean()
  if (!work || work.url) return

  const [allNotes, notesWithUrl] = await Promise.all([
    Note.find({ work: workId }).lean(),
    Note.find({ work: workId, url: { $exists: true, $ne: '' } }).lean(),
  ])

  if (allNotes.length === 0 || notesWithUrl.length !== allNotes.length) return

  // If all notes share the same hostname, use that origin; otherwise use the triggering URL
  try {
    const origins = notesWithUrl.map((n) => new URL(n.url ?? '').origin)
    const unique = [...new Set(origins)]
    await Work.findByIdAndUpdate(workId, { url: unique.length === 1 ? unique[0] : noteUrl })
  } catch {}
}

export const reqUpdateNote = async (req: Request, res: Response) => {
  const updates = { ...req.body }

  if (updates.url) {
    const existing = await Note.findById(req.params.id).lean()
    if (existing && !existing.author) {
      const { findAuthorByUrl } = await import('../auth/auth.controllers.js')
      const author = await findAuthorByUrl(updates.url)
      if (author) updates.author = author._id
    }
    if (!updates.year) {
      const year = guessYearFromUrl(updates.url)
      if (year) updates.year = year
    }
  }

  const updated = await updateNote(req.params.id, updates)

  if (updates.url && updated?.work) {
    await inferWorkUrl(updated.work, updates.url)
  }

  if (updated) {
    embedNoteIfStale(updated)
      .then(async (embeddingUpdate) => {
        if (embeddingUpdate) {
          await Note.findByIdAndUpdate(req.params.id, embeddingUpdate)
          upsertEmbedding(req.params.id, embeddingUpdate.embedding)
        }
      })
      .catch((err) => console.error('[embed] error for note', req.params.id, err))
  }

  return updated
}


// TODO: Create specific file for note.image.controllers
export const reqAddImageToNote = async (req: Request, res: Response) => {
  try {
    if (!req.files) {
      res.send({ status: false, message: 'No file' })
    } else {
      const imageField = req.files.image
      // The route only handles single uploads — collapse the array form just in case.
      const image = Array.isArray(imageField) ? imageField[0] : imageField
      if (!image) {
        res.send({ status: false, message: 'No file' })
        return
      }
      const currentNote = await Note.findOne({ _id: req.params.id })
      if (!currentNote) {
        res.status(404).end()
        return
      }
      const numberNotes = currentNote.images.length + 1

      const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      let localPath = req.params.id + '/' + numberNotes + '-' + safeName

      await fs.promises.mkdir(config.imageStorePath + '/' + req.params.id, { recursive: true })
      await image.mv(config.imageStorePath + '/' + localPath)

      const newNote = await Note.findOneAndUpdate(
        { _id: req.params.id },
        { $addToSet: { images: localPath } },
        { new: true }
      )
        .lean()
        .exec()

      res.send({
        status: true,
        message: 'File uploaded',
        data: {
          newNote,
        },
      })
    }
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqRemoveImageFromNote = async function (req: Request, res: Response) {
  try {
    const filename = req.body.filename
    const noteId = req.params.id
    const note = await Note.findById(noteId)
    if (!note) {
      res.status(404).end()
      return
    }

    if (!note.images.includes(filename)) {
      res.status(400).end()
      return
    }

    const doc = await Note.findOneAndUpdate(
      { _id: noteId },
      { $pull: { images: filename } },
      { new: true }
    )
    await fs.promises.unlink(config.imageStorePath + '/' + filename)
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetImageForNote = async function (req: Request, res: Response) {
  try {
    const note = await Note.findOne({ _id: req.params.id })
    if (!note) {
      res.status(404).end()
      return
    }
    res.sendFile(
      config.imageStorePath + '/' + note.images[Number(req.params.image) - 1]
    )
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetSuggestionForNoteTitle = async function (req: Request, res: Response) {
  try {
    const note = await Note.findOne({ _id: req.params.id })
    if (!note) {
      res.status(404).end()
      return
    }
    const suggestion = await getSuggestedTitle(note.text ?? '')
    res.send({ suggested_title: suggestion })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetSuggestedIdeasForNote = async function (req: Request, res: Response) {
  try {
    const note = await Note.findOne({ _id: req.params.id })
    if (!note) {
      res.status(404).end()
      return
    }
    const suggestion = await getSuggestedIdeas(note.title ?? '', note.text ?? '')
    res.send({ suggested_ideas: suggestion })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const createNote = async function (title: string, author: unknown) {
  const note = await Note.create({ title: title, author: author })
  generateNick('note', note._id).catch(() => {})
  return note
}

// Accepts any plain object; the schema decides which fields land. Callers
// (importers, CLI scripts) construct heterogeneous shapes and Mongoose
// silently drops anything not in the schema.
export const createNoteObj = async function (obj: object) {
  const note = await Note.create(obj)
  generateNick('note', note._id).catch(() => {})
  return note
}

export const updateNote = async (noteId: unknown, updateObj: Record<string, unknown>) => {
  return await Note.findOneAndUpdate({ _id: noteId }, updateObj, { new: true })
    .populate('author')
    .populate('ideas')
    .populate('piles')
    .populate({
      path: 'work',
      populate: {
        path: 'author',
      },
    })
    .lean()
    .exec()
}

const touchIdea = async (ideaId: unknown) => {
  if (!ideaId) return
  await Idea.findByIdAndUpdate(ideaId, { $set: { updatedAt: new Date() } })
}

const touchPile = async (pileId: unknown) => {
  if (!pileId) return
  await Pile.findByIdAndUpdate(pileId, { $set: { updatedAt: new Date() } })
}

export const reqOcrForNote = async (req: Request, res: Response) => {
  const note = await Note.findOne({ _id: req.params.id })
  if (!note) return ''

  let result = ''
  // TODO: Serial await
  for (let i = 0; i < note.images.length; i++) {
    result +=
      (await getOpenAiOCR(config.imageStorePath + '/' + note.images[i])) +
      '\n\n'
  }

  return result
}

export const reqBulkImportForWork = async (req: Request, res: Response) => {
  // TODO: Validate work ID
  const input: string = req.body.notesText
  const lines = input.split(/\r?\n/)
  const notePromises = lines
    .filter((line) => line)
    .map((line) => Note.create({ title: '', work: req.params.work, text: line }))

  await Promise.all(notePromises)
  return null
}

export const reqBulkImportNotesCSV = async (req: Request, res: Response) => {
  let csv = req.body.importList
  const recordsImported = await importCsvFromString(csv, 1)
  return recordsImported
}

export const reqBulkImportInstapaper = async (req: Request, res: Response) => {
  let tsv = req.body.importList
  const recordsImported = await importCsvFromString(tsv, 3)
  return recordsImported
}

export const reqBulkOcrForNotes = async (req: Request, res: Response) => {
  const noteIds = req.body.noteIds
  const noteDocs = await Note.find({ _id: { $in: noteIds } }).lean()
  const noteMap = Object.fromEntries(noteDocs.map(n => [String(n._id), n]))

  const notePromises = noteIds.map(async (noteId: unknown) => {
    try {
      let note = noteMap[String(noteId)]

      if (!note.text && note.images && note.images.length > 0) {
        const imagePromises = note.images.map((imagePath) =>
          getOpenAiOCR(config.imageStorePath + '/' + imagePath)
        )

        const imageResults = await Promise.all(imagePromises)
        const ocrText = imageResults.join('\n\n').trim()

        await Note.updateOne({ _id: noteId }, { $set: { text: ocrText } })

        return {
          noteId: noteId,
          success: true,
          textUpdated: true,
          ocrText: ocrText,
        }
      } else {
        return {
          noteId: noteId,
          success: true,
          textUpdated: false,
          reason: note.text ? 'Note already has text' : 'No images to process',
        }
      }
    } catch (error) {
      return {
        noteId: noteId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  const results = await Promise.all(notePromises)
  return results
}

export const reqBulkSuggestTitlesForNotes = async (req: Request, res: Response) => {
  const noteIds = req.body.noteIds
  const noteDocs = await Note.find({ _id: { $in: noteIds } }).lean()
  const noteMap = Object.fromEntries(noteDocs.map(n => [String(n._id), n]))

  const notePromises = noteIds.map(async (noteId: unknown) => {
    try {
      let note = noteMap[String(noteId)]

      if (!note.title && note.text) {
        let suggestion = await getSuggestedTitle(note.text)

        await Note.updateOne({ _id: noteId }, { $set: { title: suggestion } })

        return {
          noteId: noteId,
          success: true,
          titleUpdated: true,
          suggestedTitle: suggestion,
        }
      } else {
        return {
          noteId: noteId,
          success: true,
          titleUpdated: false,
          reason: note.title
            ? 'Note already has title'
            : 'No text to generate title from',
        }
      }
    } catch (error) {
      return {
        noteId: noteId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  const results = await Promise.all(notePromises)
  return results
}

export const reqBulkGetNotesForMarkdown = async (req: Request, res: Response) => {
  const noteIds = req.body.noteIds

  const notePromises = noteIds.map(async (noteId: unknown) => {
    try {
      let note = await Note.findOne({ _id: noteId })

      if (!note) {
        return {
          noteId: noteId,
          success: false,
          error: 'Note not found',
        }
      }

      let nick = await Nick.findOne({ note: noteId })

      if (!nick) {
        return {
          noteId: noteId,
          success: false,
          error: 'Nick not found for note',
        }
      }

      const title = note.title || 'No title'

      return {
        noteId: noteId,
        success: true,
        nick: nick.key,
        title: title,
      }
    } catch (error) {
      return {
        noteId: noteId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  const results = await Promise.all(notePromises)
  return results
}

async function hybridSearch(query: string, limit = 20): Promise<PopulatedNote[]> {
  if (!query?.trim()) return []

  const [keywordNotes, queryEmbedding] = await Promise.all([
    Note.find(
      { $text: { $search: query.replace(/\\/g, '\\\\').replace(/"/g, '\\"') } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(50)
      .select(LIST_OMIT)
      .populate('author')
      .populate('ideas')
      .populate('piles')
      .populate({ path: 'work', populate: { path: 'author' } })
      .lean()
      .exec() as Promise<PopulatedNote[]>,
    generateEmbedding(query),
  ])

  const embeddingMap = await getEmbeddingCache()

  const semanticScores: { id: string; score: number }[] = []
  for (const [id, embedding] of embeddingMap) {
    semanticScores.push({ id, score: cosineSimilarity(queryEmbedding, embedding) })
  }
  semanticScores.sort((a, b) => b.score - a.score)
  const topSemantic = semanticScores.filter((s) => s.score >= 0.38)

  const maxKeyword = keywordNotes.length > 0 ? Math.max(...keywordNotes.map((n) => n.score || 0)) : 1
  const keywordMap = new Map(keywordNotes.map((n) => [String(n._id), n]))
  const keywordScoreMap = new Map(keywordNotes.map((n) => [String(n._id), (n.score || 0) / (maxKeyword || 1)]))

  const semanticOnlyIds = topSemantic
    .map((s) => s.id)
    .filter((id) => !keywordMap.has(id))

  let semanticOnlyNotes: PopulatedNote[] = []
  if (semanticOnlyIds.length > 0) {
    semanticOnlyNotes = (await Note.find({ _id: { $in: semanticOnlyIds } })
      .select(LIST_OMIT)
      .populate('author')
      .populate('ideas')
      .populate('piles')
      .populate({ path: 'work', populate: { path: 'author' } })
      .lean()
      .exec()) as PopulatedNote[]
  }

  const semanticScoreMap = new Map(topSemantic.map((s) => [s.id, s.score]))

  const allNotes: PopulatedNote[] = [...keywordNotes, ...semanticOnlyNotes]
  const seen = new Set<string>()
  const scored: PopulatedNote[] = []
  for (const note of allNotes) {
    const id = String(note._id)
    if (seen.has(id)) continue
    seen.add(id)
    const kw = keywordScoreMap.get(id) ?? 0
    const sem = semanticScoreMap.get(id) ?? 0
    scored.push({ ...note, _hybridScore: 0.6 * kw + 0.4 * sem, _semantic: sem > 0 && kw === 0 })
  }
  scored.sort((a, b) => (b._hybridScore ?? 0) - (a._hybridScore ?? 0))
  const top = scored.filter((n) => (n._hybridScore ?? 0) >= 0.15).slice(0, limit)

  const noteIds = top.map((n) => n._id)
  const nicks = await Nick.find({ note: { $in: noteIds } }).lean().exec()
  const nickMap: Record<string, string> = {}
  nicks.forEach((nick) => {
    if (nick.note && nick.key) nickMap[String(nick.note)] = nick.key
  })
  top.forEach((note) => { note.nick = nickMap[String(note._id)] || null })

  return top
}

function scoreEntityName(name: string | undefined, query: string): number {
  if (!name) return 0.3
  const n = name.toLowerCase()
  const q = query.toLowerCase()
  if (n === q) return 1.0
  if (n.startsWith(q)) return 0.85
  if (n.includes(q)) return 0.7
  return 0.5
}

export const reqUnifiedSearch = async (req: Request, res: Response) => {
  const { query, limit = 50 } = req.body
  if (!query?.trim()) return []

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'i')

  const [notes, authors, works, ideas, piles] = await Promise.all([
    hybridSearch(query, limit),
    Auth.find({ name: regex }).lean().exec(),
    Work.find({ name: regex }).populate('author').lean().exec(),
    Idea.find({ name: regex }).lean().exec(),
    Pile.find({ name: regex }).lean().exec(),
  ])

  interface SearchResult {
    type: 'note' | 'auth' | 'work' | 'idea' | 'pile'
    item: unknown
    score: number
  }
  const results: SearchResult[] = []
  for (const note of notes)   results.push({ type: 'note', item: note, score: note._hybridScore || 0.5 })
  for (const a of authors)    results.push({ type: 'auth', item: a, score: scoreEntityName(a.name, query) })
  for (const w of works)      results.push({ type: 'work', item: w, score: scoreEntityName(w.name, query) })
  for (const i of ideas)      results.push({ type: 'idea', item: i, score: scoreEntityName(i.name, query) })
  for (const p of piles)      results.push({ type: 'pile', item: p, score: scoreEntityName(p.name, query) })

  results.sort((a, b) => b.score - a.score)
  return results
}

export const reqBulkEmbedNotes = async (req: Request, res: Response) => {
  const BATCH = 100
  let skip = 0
  let processed = 0
  let skipped = 0
  let failed = 0

  while (true) {
    const batch = await Note.find({})
      .skip(skip)
      .limit(BATCH)
      .populate('author')
      .populate('ideas')
      .populate({ path: 'work', populate: { path: 'author' } })
      .lean()
      .exec()

    if (batch.length === 0) break
    skip += batch.length

    await Promise.all(
      batch.map(async (note: any) => {
        try {
          const update = await embedNoteIfStale(note)
          if (update) {
            await Note.findByIdAndUpdate(note._id, update)
            upsertEmbedding(String(note._id), update.embedding)
            processed++
          } else {
            skipped++
          }
        } catch (err) {
          console.error('[bulk-embed] error for note', note._id, err)
          failed++
        }
      })
    )

    if (batch.length < BATCH) break
  }

  return { processed, skipped, failed }
}

export const findNotesAndPopulate = async function (
  searchObject: any,
  sortObject: any = null,
  slim = false,
  skip: any = null,
  limit: any = null,
  projection: any = LIST_OMIT
): Promise<PopulatedNote[]> {
  let notes: PopulatedNote[]
  if (slim) {
    notes = (await Note.find(searchObject)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .select(projection)
      .lean()
      .exec()) as PopulatedNote[]
  } else {
    notes = (await Note.find(searchObject)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .select(projection)
      .populate('author')
      .populate('ideas')
      .populate('piles')
      .populate({
        path: 'work',
        populate: { path: 'author' },
      })
      .lean()
      .exec()) as PopulatedNote[]
  }

  const noteIds = notes.map((note) => note._id)
  const nicks = await Nick.find({ note: { $in: noteIds } }).lean().exec()

  const nickMap: Record<string, string> = {}
  nicks.forEach((nick) => {
    if (nick.note && nick.key) nickMap[String(nick.note)] = nick.key
  })

  notes.forEach((note) => {
    note.nick = nickMap[String(note._id)] || null
  })

  return notes
}

export const findRandomNotesAndPopulate = async function (
  searchObject: Record<string, unknown>,
  limit = pageSize
) {
  const random_notes = await Note.aggregate([
    { $sample: { size: limit } },
  ]).exec()

  const populated_notes = await Note.populate(random_notes, [
    { path: 'author' },
    { path: 'ideas' },
    { path: 'piles' },
    { path: 'work', populate: { path: 'author' } },
  ])

  const noteIds = populated_notes.map((note: any) => note._id)
  const nicks = await Nick.find({ note: { $in: noteIds } })
    .lean()
    .exec()

  const nickMap: Record<string, string> = {}
  nicks.forEach((nick: any) => {
    nickMap[String(nick.note)] = nick.key
  })

  populated_notes.forEach((note: any) => {
    note.nick = nickMap[String(note._id)] || null
  })

  return populated_notes
}

export default defaultControllers(Note)
