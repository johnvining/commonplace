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

const pageSize = 40

// Fields that are large and not needed in list views
const LIST_OMIT = '-embedding -ocrText -embeddingHash'

export const reqFindNotesByString = async (req, res) => {
  const escaped = req.body.searchString.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const notes = await Note.find(
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
    .exec()

  const noteIds = notes.map((n) => n._id)
  const nicks = await Nick.find({ note: { $in: noteIds } }).lean().exec()
  const nickMap = {}
  nicks.forEach((nick) => { nickMap[nick.note] = nick.key })
  notes.forEach((note) => { note.nick = nickMap[note._id] || null })
  return notes
}

export const reqGetNoteDetails = async (req, res) => {
  return await findNotesAndPopulate({ _id: req.params.id }, null, false, null, null, null)
}

export const reqDeleteNote = async (req, res) => {
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

export const reqGetRecentNotes = async (req, res) => {
  return findNotesAndPopulate(
    {},
    { updatedAt: -1 },
    false,
    (req.params.skip - 1) * pageSize,
    pageSize
  )
}

export const reqGetEarliestNotesToFile = async (req, res) => {
  // TODO: Faster way to do this? -- size: 0 may be slow
  return findNotesAndPopulate(
    { ideas: { $size: 0 } },
    { updatedAt: 1 },
    false,
    (req.params.skip - 1) * pageSize,
    pageSize
  )
}

export const reqGetRandomNotes = async (req, res) => {
  return findRandomNotesAndPopulate({}, pageSize)
}

export const reqAddIdea = async (req, res) => {
  const doc = await updateNote(req.params.id, { $addToSet: { ideas: req.body.id } })
  await touchIdea(req.body.id)
  return doc
}

export const reqAddNewIdea = async (req, res) => {
  const newIdea = await IdeaControllers.createIdea(req.body.name)
  const doc = await updateNote(req.params.id, { $addToSet: { ideas: newIdea._id } })
  await touchIdea(newIdea._id)
  return doc
}

export const reqRemoveIdeaFromNote = async (req, res) => {
  const doc = await updateNote(req.params.id, {
    $pull: { ideas: req.params.ideaId },
  })
  await touchIdea(req.params.ideaId)
  return doc
}

export const reqAddPile = async (req, res) => {
  const doc = await updateNote(req.params.id, { $addToSet: { piles: req.body.id } })
  await touchPile(req.body.id)
  return doc
}

export const reqAddNewPile = async (req, res) => {
  const newPile = await Pile.create({ name: req.body.name })
  const doc = await updateNote(req.params.id, { $addToSet: { piles: newPile._id } })
  await touchPile(newPile._id)
  return doc
}

export const reqRemovePileFromNote = async (req, res) => {
  const doc = await updateNote(req.params.id, { $pull: { piles: req.params.pileId } })
  if (!doc) {
    return res.status(400).end()
  }
  await touchPile(req.params.pileId)
  return doc
}

export const reqAddWork = async (req, res) => {
  return await updateNote(req.params.id, { work: req.body.newWork })
}

export const reqAddNewWork = async (req, res) => {
  const newWork = await WorkControllers.createWork(req.body.newWork)
  return await addWorkToId(req.params.id, newWork._id)
}

const inferWorkUrl = async function (workId, noteUrl) {
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
    const origins = notesWithUrl.map(n => new URL(n.url).origin)
    const unique = [...new Set(origins)]
    await Work.findByIdAndUpdate(workId, { url: unique.length === 1 ? unique[0] : noteUrl })
  } catch {}
}

export const reqUpdateNote = async (req, res) => {
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
export const reqAddImageToNote = async (req, res) => {
  try {
    if (!req.files) {
      res.send({ status: false, message: 'No file' })
    } else {
      let image = req.files.image
      let currentNote = await Note.findOne({ _id: req.params.id })
      let numberNotes = currentNote.images.length + 1

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

export const reqRemoveImageFromNote = async function (req, res) {
  try {
    var filename = req.body.filename
    const noteId = req.params.id
    const note = await Note.findById(noteId)

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

export const reqGetImageForNote = async function (req, res) {
  try {
    let note = await Note.findOne({ _id: req.params.id })
    res.sendFile(
      config.imageStorePath + '/' + note.images[req.params.image - 1]
    )
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetSuggestionForNoteTitle = async function (req, res) {
  try {
    let note = await Note.findOne({ _id: req.params.id })
    let suggestion = await getSuggestedTitle(note.text)
    res.send({ suggested_title: suggestion })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetSuggestedIdeasForNote = async function (req, res) {
  try {
    let note = await Note.findOne({ _id: req.params.id })
    let suggestion = await getSuggestedIdeas(note.title, note.text)
    res.send({ suggested_ideas: suggestion })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const createNote = async function (title, author) {
  const note = await Note.create({ title: title, author: author })
  generateNick('note', note._id).catch(() => {})
  return note
}

export const createNoteObj = async function (obj) {
  const note = await Note.create(obj)
  generateNick('note', note._id).catch(() => {})
  return note
}

export const updateNote = async (noteId, updateObj) => {
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

const touchIdea = async (ideaId) => {
  if (!ideaId) return
  await Idea.findByIdAndUpdate(ideaId, { $set: { updatedAt: new Date() } })
}

const touchPile = async (pileId) => {
  if (!pileId) return
  await Pile.findByIdAndUpdate(pileId, { $set: { updatedAt: new Date() } })
}

export const reqOcrForNote = async (req, res) => {
  let note = await Note.findOne({ _id: req.params.id })

  var result = ''
  // TODO: Serial await
  for (let i = 0; i < note.images.length; i++) {
    result +=
      (await getOpenAiOCR(config.imageStorePath + '/' + note.images[i])) +
      '\n\n'
  }

  return result
}

export const reqBulkImportForWork = async (req, res) => {
  // TODO: Validate work ID
  let input = req.body.notesText
  let lines = input.split(/\r?\n/)
  let notePromises = []
  lines.map((line) => {
    if (line) {
      notePromises.push(
        Note.create({ title: '', work: req.params.work, text: line })
      )
    }
  })

  await Promise.all(notePromises)
  return null
}

export const reqBulkImportNotesCSV = async (req, res) => {
  let csv = req.body.importList
  const recordsImported = await importCsvFromString(csv, 1)
  return recordsImported
}

export const reqBulkImportInstapaper = async (req, res) => {
  let tsv = req.body.importList
  const recordsImported = await importCsvFromString(tsv, 3)
  return recordsImported
}

export const reqBulkOcrForNotes = async (req, res) => {
  const noteIds = req.body.noteIds
  const noteDocs = await Note.find({ _id: { $in: noteIds } }).lean()
  const noteMap = Object.fromEntries(noteDocs.map(n => [String(n._id), n]))

  const notePromises = noteIds.map(async (noteId) => {
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
        error: error.message,
      }
    }
  })

  const results = await Promise.all(notePromises)
  return results
}

export const reqBulkSuggestTitlesForNotes = async (req, res) => {
  const noteIds = req.body.noteIds
  const noteDocs = await Note.find({ _id: { $in: noteIds } }).lean()
  const noteMap = Object.fromEntries(noteDocs.map(n => [String(n._id), n]))

  const notePromises = noteIds.map(async (noteId) => {
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
        error: error.message,
      }
    }
  })

  const results = await Promise.all(notePromises)
  return results
}

export const reqBulkGetNotesForMarkdown = async (req, res) => {
  const noteIds = req.body.noteIds

  const notePromises = noteIds.map(async (noteId) => {
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
        error: error.message,
      }
    }
  })

  const results = await Promise.all(notePromises)
  return results
}

async function hybridSearch(query, limit = 20) {
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
      .exec(),
    generateEmbedding(query),
  ])

  const embeddingMap = await getEmbeddingCache()

  const semanticScores = []
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

  let semanticOnlyNotes = []
  if (semanticOnlyIds.length > 0) {
    semanticOnlyNotes = await Note.find({ _id: { $in: semanticOnlyIds } })
      .select(LIST_OMIT)
      .populate('author')
      .populate('ideas')
      .populate('piles')
      .populate({ path: 'work', populate: { path: 'author' } })
      .lean()
      .exec()
  }

  const semanticScoreMap = new Map(topSemantic.map((s) => [s.id, s.score]))

  const allNotes = [...keywordNotes, ...semanticOnlyNotes]
  const seen = new Set()
  const scored = []
  for (const note of allNotes) {
    const id = String(note._id)
    if (seen.has(id)) continue
    seen.add(id)
    const kw = keywordScoreMap.get(id) ?? 0
    const sem = semanticScoreMap.get(id) ?? 0
    scored.push({ ...note, _hybridScore: 0.6 * kw + 0.4 * sem, _semantic: sem > 0 && kw === 0 })
  }
  scored.sort((a, b) => b._hybridScore - a._hybridScore)
  const top = scored.filter((n) => n._hybridScore >= 0.15).slice(0, limit)

  const noteIds = top.map((n) => n._id)
  const nicks = await Nick.find({ note: { $in: noteIds } }).lean().exec()
  const nickMap = {}
  nicks.forEach((nick) => { nickMap[nick.note] = nick.key })
  top.forEach((note) => { note.nick = nickMap[note._id] || null })

  return top
}

function scoreEntityName(name, query) {
  if (!name) return 0.3
  const n = name.toLowerCase()
  const q = query.toLowerCase()
  if (n === q) return 1.0
  if (n.startsWith(q)) return 0.85
  if (n.includes(q)) return 0.7
  return 0.5
}

export const reqHybridSearch = async (req, res) => {
  const { query, limit = 20 } = req.body
  return hybridSearch(query, limit)
}

export const reqUnifiedSearch = async (req, res) => {
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

  const results = []
  for (const note of notes)   results.push({ type: 'note', item: note, score: note._hybridScore || 0.5 })
  for (const a of authors)    results.push({ type: 'auth', item: a, score: scoreEntityName(a.name, query) })
  for (const w of works)      results.push({ type: 'work', item: w, score: scoreEntityName(w.name, query) })
  for (const i of ideas)      results.push({ type: 'idea', item: i, score: scoreEntityName(i.name, query) })
  for (const p of piles)      results.push({ type: 'pile', item: p, score: scoreEntityName(p.name, query) })

  results.sort((a, b) => b.score - a.score)
  return results
}

export const reqBulkEmbedNotes = async (req, res) => {
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
      batch.map(async (note) => {
        try {
          const update = await embedNoteIfStale(note)
          if (update) {
            await Note.findByIdAndUpdate(note._id, update)
            upsertEmbedding(note._id, update.embedding)
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
  searchObject,
  sortObject,
  slim = false,
  skip = null,
  limit = null,
  projection = LIST_OMIT
) {
  let notes
  if (slim) {
    notes = await Note.find(searchObject)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .select(projection)
      .lean()
      .exec()
  } else {
    notes = await Note.find(searchObject)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .select(projection)
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

  const noteIds = notes.map((note) => note._id)
  const nicks = await Nick.find({ note: { $in: noteIds } })
    .lean()
    .exec()

  const nickMap = {}
  nicks.forEach((nick) => {
    nickMap[nick.note] = nick.key
  })

  notes.forEach((note) => {
    note.nick = nickMap[note._id] || null
  })

  return notes
}

export const findRandomNotesAndPopulate = async function (
  searchObject,
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

  const noteIds = populated_notes.map((note) => note._id)
  const nicks = await Nick.find({ note: { $in: noteIds } })
    .lean()
    .exec()

  const nickMap = {}
  nicks.forEach((nick) => {
    nickMap[nick.note] = nick.key
  })

  populated_notes.forEach((note) => {
    note.nick = nickMap[note._id] || null
  })

  return populated_notes
}

export default defaultControllers(Note)
