import Note from './note.model.js'
import { Auth } from '../auth/auth.model.js'
import Pile from '../pile/pile.model.js'
import Idea from '../idea/idea.model.js'
import Work from '../work/work.model.js'
import { importCsvFromString } from '../../cli/import.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import * as IdeaControllers from '../idea/idea.controllers.js'
import * as WorkControllers from '../work/work.controllers.js'
import {
  getSuggestedIdeas,
  getOpenAiOCR,
} from '../../utils/suggestions.js'
import config from '../../config'
import fs from 'fs'
import { guessYearFromUrl } from '../../utils/urls.js'
import { embedNoteIfStale, generateEmbedding, cosineSimilarity } from '../../utils/embeddings.js'
import { getEmbeddingCache } from '../../utils/embeddingCache.js'
import { saveEmbedding } from '../../utils/embeddingRefresh.js'
import { ocrMayWrite } from '../../utils/noteText.js'
import { checkedTitleSource, suggestTitle } from '../../utils/noteTitle.js'
import { nickFor, nickKeysFor, resolveNick } from '../nick/nickLifecycle.js'
import { deleteEntity } from '../../utils/deleteEntity.js'
import { sanitizeSearchInput, escapeRegexInput, wordPrefixFilter } from '../../utils/searchInput.js'
import { pickAllowed } from '../../utils/pickAllowed.js'
import { autoOcrNote, isOcrConfigured } from '../../utils/autoOcr.js'
import type { Request, Response } from 'express'
import { findEntityNotesPage } from '../../utils/pagination.js'
import mongoose, { isValidObjectId } from 'mongoose'
import {
  NEVER_REVIEWED,
  RATINGS,
  REVIEWED,
  buildDeck,
  deckSize,
  reviewState,
  scheduleReview,
  type Rating,
} from '../../utils/review.js'


const pageSize = 40

// Fields that are large and not needed in list views
const LIST_OMIT = '-embedding -ocrText'

// Embeddings and their hash are server-controlled; nothing in the client
// payload should be able to overwrite them.
const NOTE_WRITABLE = [
  'title', 'authors', 'text', 'ideas', 'work', 'year', 'url',
  'images', 'page', 'piles', 'take', 'ocrText', 'people', 'titleSource',
] as const

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

// Keyword search over notes (#297), used by unified search and
// PUT /note/find. Two parts, merged:
// - Mongo $text: ranked by textScore, any of the words matches (with
//   stemming), "quoted phrases" must appear. Mongo drops stop words, so
//   a query made of them ("not at all") finds nothing this way.
// - The whole query as a case-insensitive phrase in the title, text,
//   take or OCR text. That catches the stop-word case, and those exact
//   hits rank first.
// Each note gets `score`, highest first.
const PHRASE_FIELDS = ['title', 'text', 'take', 'ocrText'] as const

async function keywordSearchNotes(rawQuery: string, limit: number): Promise<PopulatedNote[]> {
  const query = sanitizeSearchInput(rawQuery).trim()
  if (!query) return []
  const populate = (q: any) =>
    q
      .select(LIST_OMIT)
      .populate('authors')
      .populate('people')
      .populate('ideas')
      .populate('piles')
      .populate({ path: 'work', populate: { path: 'authors' } })
      .lean()
      .exec() as Promise<PopulatedNote[]>

  // The phrase is the query without its quote marks.
  const phrase = query.replace(/"/g, '').trim()
  const phraseRegex = new RegExp(escapeRegexInput(phrase), 'i')
  const [textHits, phraseHits] = await Promise.all([
    populate(
      Note.find(
        { $text: { $search: query.replace(/\\/g, '\\\\') } },
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
    ),
    phrase
      ? populate(
          Note.find({ $or: PHRASE_FIELDS.map((f) => ({ [f]: phraseRegex })) })
            .sort({ updatedAt: -1 })
            .limit(limit)
        )
      : Promise.resolve([] as PopulatedNote[]),
  ])

  // Phrase hits outrank any text score; text hits keep their order.
  const maxText = Math.max(1, ...textHits.map((n) => n.score || 0))
  const byId = new Map<string, PopulatedNote>()
  for (const n of textHits) byId.set(String(n._id), { ...n, score: (n.score || 0) / maxText })
  for (const n of phraseHits) {
    const prev = byId.get(String(n._id))
    byId.set(String(n._id), { ...(prev ?? n), score: 1 + (prev?.score ?? 0) })
  }
  return [...byId.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
}

async function attachNicks(notes: PopulatedNote[]) {
  const keys = await nickKeysFor('note', notes.map((n) => n._id))
  notes.forEach((note) => { note.nick = keys.get(String(note._id)) ?? null })
}

export const reqFindNotesByString = async (req: Request, res: Response) => {
  const notes = await keywordSearchNotes(req.body.searchString, 200)
  await attachNicks(notes)
  return notes
}

export const reqGetNoteDetails = async (req: Request, res: Response) => {
  return await findNotesAndPopulate({ _id: req.params.id }, null, false, null, null, null)
}

// Resolves a nick string → the populated note. Mirrors the shape returned by
// reqGetNoteDetails so the frontend can swap calls transparently.
export const reqGetNoteByNick = async (req: Request, res: Response) => {
  const found = await resolveNick(String(req.params.nick))
  if (!found || found.state === 'retired' || found.type !== 'note') return []
  return await findNotesAndPopulate({ _id: found.id }, null, false, null, null, null)
}

export const reqDeleteNote = async (req: Request, res: Response) => {
  await deleteEntity('note', String(req.params.id))
  res.status(200).end()
}

export const reqGetRecentNotes = async (req: Request, res: Response) => {
  return findNotesAndPopulate(
    {},
    { updatedAt: -1 },
    false,
    // Pages start at 1; clamp so page 0 or junk can't send a negative skip
    Math.max(0, (Number(req.params.skip) - 1) * pageSize || 0),
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

// GET /note/flip?since=<ISO date>: a review deck. Reviewed notes are
// ranked by how far through their interval they are (with some
// randomness), and a share of never-reviewed notes is mixed in; see
// utils/review.ts. The deck holds what's left of FLIP_PER_DAY after the
// notes rated since `since` (the start of the reader's day; the server's
// midnight if missing or invalid).
export const reqGetRandomNotes = async (req: Request, res: Response) => {
  let since = new Date(String(req.query.since))
  if (isNaN(since.getTime())) {
    since = new Date()
    since.setHours(0, 0, 0, 0)
  }
  const ratedToday = await Note.countDocuments({ ...REVIEWED, reviewedAt: { $gte: since } }).exec()
  const size = deckSize(ratedToday)
  if (!size) return []
  const reviewFields = { reviewedAt: 1, reviewDueAt: 1, reviewCount: 1, lastOpenedAt: 1 }
  const [reviewed, unreviewed] = await Promise.all([
    Note.find(REVIEWED, reviewFields).lean().exec(),
    // Sampled rather than loaded whole: there can be a lot of them. The
    // pool is bigger than the deck so buildDeck can lean toward ones not
    // seen lately.
    Note.aggregate([
      { $match: NEVER_REVIEWED },
      { $sample: { size: size * 4 } },
      { $project: reviewFields },
    ]).exec(),
  ])
  const deck = buildDeck(reviewed, unreviewed, size)
  const ids = deck.map((card) => card._id)
  const notes = await findNotesAndPopulate({ _id: { $in: ids } })
  const order = new Map(ids.map((id, i) => [String(id), i]))
  return notes.sort((a, b) => order.get(String(a._id))! - order.get(String(b._id))!)
}

// POST /note/:id/review { rating: 'fast' | 'med' | 'slow' }: record a
// review and schedule the next one. Doesn't touch updatedAt, so reviewing
// doesn't reorder the recent list.
export const reqReviewNote = async (req: Request, res: Response) => {
  const rating = req.body?.rating
  if (!RATINGS.includes(rating)) {
    return res.status(400).json({ message: `rating must be one of ${RATINGS.join(', ')}` })
  }
  const existing = await Note.findById(req.params.id).lean().exec()
  if (!existing) return res.status(404).json({ message: 'Not found' })
  const update = scheduleReview(existing, rating as Rating)
  await Note.updateOne({ _id: existing._id }, { $set: update }, { timestamps: false })
  return { ...update, reviewState: reviewState(update) }
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
    return res.status(400).json({ message: 'Note not found' })
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
  const updates: Record<string, unknown> = pickAllowed(req.body, NOTE_WRITABLE)

  // A title claimed as AI-made must be the note's last suggestion (#370).
  // With no source (null: not sure), the model decides: an unchanged
  // title keeps its source, a changed one becomes the user's.
  if ('titleSource' in updates) {
    if (updates.titleSource == null) {
      delete updates.titleSource
    } else {
      const current = await Note.findById(req.params.id, { title: 1, aiTitle: 1 }).lean()
      updates.titleSource = checkedTitleSource(updates.titleSource, updates.title ?? current?.title, current?.aiTitle)
    }
  }

  const url = typeof updates.url === 'string' ? updates.url : null
  if (url) {
    const existing = await Note.findById(req.params.id).lean()
    // Only infer authors from URL if the caller didn't already set them and
    // the note had none before. Don't clobber a deliberate choice.
    const incomingAuthors = Array.isArray(updates.authors) ? updates.authors : null
    if (existing && !existing.authors?.length && !incomingAuthors?.length) {
      const { findAuthorByUrl } = await import('../auth/auth.controllers.js')
      const author = await findAuthorByUrl(url)
      if (author) updates.authors = [author._id]
    }
    if (!updates.year) {
      const year = guessYearFromUrl(url)
      if (year) updates.year = year
    }
  }

  const updated = await updateNote(req.params.id, updates)

  if (url && updated?.work) {
    await inferWorkUrl(updated.work, url)
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
      const currentNote = await Note.findOne({ _id: req.params.id }, { _id: 1 }).lean()
      if (!currentNote) {
        res.status(404).json({ message: 'Note not found' })
        return
      }

      // A fresh id per file: numbering by image count reused the name of
      // an image still on the note after one was removed, and overwrote
      // it (#368). The folder is the stored _id, never the URL param.
      const noteId = String(currentNote._id)
      const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const localPath = noteId + '/' + new mongoose.Types.ObjectId().toHexString() + '-' + safeName
      const fullPath = config.imageStorePath + '/' + localPath

      await fs.promises.mkdir(config.imageStorePath + '/' + noteId, { recursive: true })
      await image.mv(fullPath)

      // If the note can't take the file (deleted meanwhile, or the write
      // fails), don't leave the file behind on disk.
      let newNote
      try {
        newNote = await Note.findOneAndUpdate(
          { _id: noteId },
          { $addToSet: { images: localPath } },
          { new: true }
        )
          .lean()
          .exec()
      } catch (e) {
        await fs.promises.unlink(fullPath).catch(() => {})
        throw e
      }
      if (!newNote) {
        await fs.promises.unlink(fullPath).catch(() => {})
        res.status(404).json({ message: 'Note not found' })
        return
      }

      // Read the new image into the note's text (#331). The upload has
      // already succeeded, so an OCR failure only gets logged.
      let note = newNote
      if (isOcrConfigured()) {
        try {
          const ocrNote = await autoOcrNote(req.params.id, [localPath])
          if (ocrNote) note = ocrNote
        } catch (e) {
          console.error('[auto-ocr] failed for note', req.params.id, e)
        }
      }

      res.send({
        status: true,
        message: 'File uploaded',
        data: {
          newNote: note,
        },
      })
    }
  } catch (e) {
    console.error(e)
    res.status(400).json({ message: 'Could not save the image: ' + (e instanceof Error ? e.message : String(e)) })
  }
}

export const reqRemoveImageFromNote = async function (req: Request, res: Response) {
  try {
    const filename = req.body.filename
    const noteId = req.params.id
    const note = await Note.findById(noteId)
    if (!note) {
      res.status(404).json({ message: 'Note not found' })
      return
    }

    if (!note.images.includes(filename)) {
      res.status(400).json({ message: 'That image is not on this note' })
      return
    }

    const doc = await Note.findOneAndUpdate(
      { _id: noteId },
      { $pull: { images: filename } },
      { new: true }
    )
    // The note no longer lists it, so the removal has happened. A file
    // that's already gone is fine; any other failure leaves an orphan for
    // the image reconciliation task, not an error for the user.
    await fs.promises.unlink(config.imageStorePath + '/' + filename).catch((e) => {
      if (e?.code !== 'ENOENT') console.error(`Could not remove image file ${filename}`, e)
    })
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).json({ message: 'Could not remove the image: ' + (e instanceof Error ? e.message : String(e)) })
  }
}

export const reqGetImageForNote = async function (req: Request, res: Response) {
  try {
    // Only need the images array, not the full doc (embedding alone is ~2 KB).
    const note = await Note.findOne({ _id: req.params.id }, { images: 1 }).lean()
    if (!note) {
      res.status(404).json({ message: 'Note not found' })
      return
    }
    // Browser-side cache for blob URL fetches — images are immutable per path.
    res.set('Cache-Control', 'private, max-age=3600')
    res.sendFile(
      config.imageStorePath + '/' + note.images[Number(req.params.image) - 1]
    )
  } catch (e) {
    console.error(e)
    res.status(400).json({ message: 'Could not read the image: ' + (e instanceof Error ? e.message : String(e)) })
  }
}

export const reqGetSuggestionForNoteTitle = async function (req: Request, res: Response) {
  try {
    const note = await Note.findOne({ _id: req.params.id })
    if (!note) {
      res.status(404).json({ message: 'Note not found' })
      return
    }
    // Remembered as aiTitle, so saving it can mark the title as AI-made
    const { suggestion } = await suggestTitle(Note, note)
    res.send({ suggested_title: suggestion })
  } catch (e) {
    console.error(e)
    res.status(400).json({ message: 'Could not get a title suggestion: ' + (e instanceof Error ? e.message : String(e)) })
  }
}

export const reqGetSuggestedIdeasForNote = async function (req: Request, res: Response) {
  try {
    const note = await Note.findOne({ _id: req.params.id })
    if (!note) {
      res.status(404).json({ message: 'Note not found' })
      return
    }
    const suggestion = await getSuggestedIdeas(note.title ?? '', note.text ?? '')
    res.send({ suggested_ideas: suggestion })
  } catch (e) {
    console.error(e)
    res.status(400).json({ message: 'Could not get idea suggestions: ' + (e instanceof Error ? e.message : String(e)) })
  }
}

export const createNote = async function (title: string, author: unknown) {
  const authors = author ? [author as any] : []
  return Note.create({ title: title, authors: authors })
}

// Accepts any plain object; the schema decides which fields land. Callers
// (importers, CLI scripts) construct heterogeneous shapes and Mongoose
// silently drops anything not in the schema.
export const createNoteObj = async function (obj: object) {
  return Note.create(obj)
}

export const updateNote = async (noteId: unknown, updateObj: Record<string, unknown>) => {
  return await Note.findOneAndUpdate({ _id: noteId }, updateObj, { new: true })
    .populate('authors')
    .populate('people')
    .populate('ideas')
    .populate('piles')
    .populate({
      path: 'work',
      populate: {
        path: 'authors',
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

  // '' when none of the images has text.
  const texts: string[] = []
  // TODO: Serial await
  for (let i = 0; i < note.images.length; i++) {
    texts.push((await getOpenAiOCR(config.imageStorePath + '/' + note.images[i])) ?? '')
  }

  return texts.filter((t) => t.trim()).join('\n\n')
}

// Cap on bulk operations — prevents a runaway request from creating a million
// rows or burning the OpenAI bill via a giant noteIds list.
const BULK_LIMIT = 1000

export const reqBulkImportForWork = async (req: Request, res: Response) => {
  // TODO: Validate work ID
  const input: string = req.body.notesText
  const lines = input.split(/\r?\n/).filter((line) => line).slice(0, BULK_LIMIT)
  const notePromises = lines
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
  const noteIds = Array.isArray(req.body.noteIds) ? req.body.noteIds.slice(0, BULK_LIMIT) : []
  const noteDocs = await Note.find({ _id: { $in: noteIds } }).lean()
  const noteMap = Object.fromEntries(noteDocs.map(n => [String(n._id), n]))

  const notePromises = noteIds.map(async (noteId: unknown) => {
    try {
      const note = noteMap[String(noteId)]
      if (!note) return { noteId, success: false, error: 'Note not found' }
      if (!note.images?.length) return { noteId, success: true, textUpdated: false, reason: 'No images to process' }
      if (!ocrMayWrite(note)) return { noteId, success: true, textUpdated: false, reason: 'Note already has text' }

      // The same path as OCR on upload, so text, ocrText and the text
      // source stay in step (#379)
      const updated = await autoOcrNote(note._id)
      if (!updated) return { noteId, success: true, textUpdated: false, reason: 'No new text in the images' }
      return { noteId, success: true, textUpdated: true, ocrText: updated.text }
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
  const noteIds = Array.isArray(req.body.noteIds) ? req.body.noteIds.slice(0, BULK_LIMIT) : []
  const noteDocs = await Note.find({ _id: { $in: noteIds } }).lean()
  const noteMap = Object.fromEntries(noteDocs.map(n => [String(n._id), n]))

  const notePromises = noteIds.map(async (noteId: unknown) => {
    try {
      const note = noteMap[String(noteId)]
      if (!note) return { noteId, success: false, error: 'Note not found' }

      if (!note.title && note.text) {
        // The same path as a single suggestion, applied as the title
        const { suggestion, applied } = await suggestTitle(Note, note, { apply: true })
        return {
          noteId: noteId,
          success: true,
          titleUpdated: applied,
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
  const noteIds = Array.isArray(req.body.noteIds) ? req.body.noteIds.slice(0, BULK_LIMIT) : []

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

      const nick = await nickFor('note', noteId)

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
  query = sanitizeSearchInput(query)
  if (!query.trim()) return []

  const [keywordNotes, queryEmbedding] = await Promise.all([
    keywordSearchNotes(query, Math.max(50, limit)),
    // Semantic matching needs OpenAI. If it's down, rate-limited or the
    // key is revoked, fall back to keyword results instead of failing
    // the whole search.
    // A short leash: someone is waiting on these results.
    generateEmbedding(query, { timeout: 5000, maxRetries: 1 }).catch((err) => {
      console.error('[search] query embedding failed; keyword results only:', err?.message ?? err)
      return null
    }),
  ])

  const semanticScores: { id: string; score: number }[] = []
  if (queryEmbedding) {
    const embeddingMap = await getEmbeddingCache()
    for (const [id, embedding] of embeddingMap) {
      semanticScores.push({ id, score: cosineSimilarity(queryEmbedding, embedding) })
    }
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
      .populate('authors')
      .populate('people')
      .populate('ideas')
      .populate('piles')
      .populate({ path: 'work', populate: { path: 'authors' } })
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

  await attachNicks(top)

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
  const query = sanitizeSearchInput(req.body.query)
  // Notes to return; the tagging view (#319) asks for up to the cap.
  const MAX_NOTES = 200
  const requested = Number(req.body.limit)
  const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_NOTES) : 50
  if (!query.trim()) return []

  const byName = wordPrefixFilter('name', query)

  const [notes, authors, works, ideas, piles] = await Promise.all([
    hybridSearch(query, limit),
    Auth.find(byName).lean().exec(),
    Work.find({ $or: [byName, wordPrefixFilter('original_name', query)] }).populate('authors').lean().exec(),
    Idea.find(byName).lean().exec(),
    Pile.find(byName).lean().exec(),
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

// Iterate notes matching `filter`, embed any whose content hash has changed,
// persist + populate the in-memory cache. Used by the bulk-embed endpoint
// and by the bulk import endpoints (which scope it to un-embedded notes
// to avoid re-scanning the full collection on every import).
export async function embedStaleNotes(filter: Record<string, unknown> = {}) {
  const BATCH = 100
  let skip = 0
  let processed = 0
  let skipped = 0
  let failed = 0

  while (true) {
    const batch = await Note.find(filter)
      .skip(skip)
      .limit(BATCH)
      .populate('authors')
      .populate('people')
      .populate('ideas')
      .populate({ path: 'work', populate: { path: 'authors' } })
      .lean()
      .exec()

    if (batch.length === 0) break
    skip += batch.length

    await Promise.all(
      batch.map(async (note: any) => {
        try {
          const update = await embedNoteIfStale(note)
          await saveEmbedding(note._id, update, note.updatedAt)
          if (update) processed++
          else skipped++
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

export const reqBulkEmbedNotes = async (req: Request, res: Response) => {
  return embedStaleNotes()
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
      .populate('authors')
      .populate('people')
      .populate('ideas')
      .populate('piles')
      .populate({
        path: 'work',
        populate: { path: 'authors' },
      })
      .lean()
      .exec()) as PopulatedNote[]
  }

  await attachNicks(notes)
  // Where each note stands for review, worked out once, here (#380)
  const now = new Date()
  notes.forEach((note: any) => { note.reviewState = reviewState(note, now) })
  return notes
}

export default defaultControllers(Note, { writable: NOTE_WRITABLE })

// GET /note/filter?piles=a,b&ideas=c: notes in every listed pile and
// with every listed idea (#279). Paged like the entity-notes endpoints.
export const reqFilterNotes = async (req: Request, res: Response) => {
  const ids = (param: unknown) =>
    String(param ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  const piles = ids(req.query.piles)
  const ideas = ids(req.query.ideas)
  if (!piles.length && !ideas.length) {
    return res.status(400).json({ message: 'Give at least one pile or idea' })
  }
  if (![...piles, ...ideas].every((id) => isValidObjectId(id))) {
    return res.status(400).json({ message: 'Invalid id' })
  }
  const query: Record<string, unknown> = {}
  if (piles.length) query.piles = { $all: piles }
  if (ideas.length) query.ideas = { $all: ideas }
  return findEntityNotesPage(req, res, query, { updatedAt: -1 })
}
