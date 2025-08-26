import Note from './note.model.js'
import Pile from '../pile/pile.model.js'
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

const pageSize = 40

export const reqFindNotesByString = async (req, res) => {
  return await findNotesAndPopulate(
    { $text: { $search: '"' + req.body.searchString + '"' } },
    {}
  )
}

export const reqGetNoteDetails = async (req, res) => {
  return await findNotesAndPopulate({ _id: req.params.id })
}

export const reqDeleteNote = async (req, res) => {
  // TODO: Delete images when deleting note, #101
  const id = req.params.id
  await Note.deleteOne({ _id: id })
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
  return await updateNote(req.params.id, { $addToSet: { ideas: req.body.id } })
}

export const reqAddNewIdea = async (req, res) => {
  const newIdea = await IdeaControllers.createIdea(req.body.name)
  return await updateNote(req.params.id, { $addToSet: { ideas: newIdea._id } })
}

export const reqRemoveIdeaFromNote = async (req, res) => {
  return await updateNote(req.params.id, {
    $pull: { ideas: req.params.ideaId },
  })
}

export const reqAddPile = async (req, res) => {
  return await updateNote(req.params.id, { $addToSet: { piles: req.body.id } })
}

export const reqAddNewPile = async (req, res) => {
  const newPile = await Pile.create({ name: req.body.name })
  return await updateNote(req.params.id, { $addToSet: { piles: newPile._id } })
}

export const reqRemovePileFromNote = async (req, res) => {
  const doc = updateNote(req.params.id, { $pull: { piles: req.params.pileId } })
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqAddWork = async (req, res) => {
  return await updateNote(req.params.id, { work: req.body.newWork })
}

export const reqAddNewWork = async (req, res) => {
  const newWork = await WorkControllers.createWork(req.body.newWork)
  return await addWorkToId(req.params.id, newWork._id)
}

export const reqUpdateNote = async (req, res) => {
  return await updateNote(req.params.id, req.body)
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

      let localPath = req.params.id + '/' + numberNotes + '-' + image.name

      image.mv(config.imageStorePath + '/' + localPath)

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
    fs.unlink(config.imageStorePath + '/' + filename, () => {
      res.status(200).json({ data: doc })
    })
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
  return await Note.create({ title: title, author: author })
}

export const createNoteObj = async function (obj) {
  return await Note.create(obj)
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
  let recordsImported = -2
  try {
    let csv = req.body.importList
    recordsImported = await importCsvFromString(csv, 1)
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }

  return recordsImported
}

export const reqBulkOcrForNotes = async (req, res) => {
  const noteIds = req.body.noteIds

  const notePromises = noteIds.map(async (noteId) => {
    try {
      let note = await Note.findOne({ _id: noteId })

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

  const notePromises = noteIds.map(async (noteId) => {
    try {
      let note = await Note.findOne({ _id: noteId })

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

// slim: don't need any population
export const findNotesAndPopulate = async function (
  searchObject,
  sortObject,
  slim = false,
  skip = null,
  limit = null
) {
  if (slim) {
    return await Note.find(searchObject)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec()
  } else {
    return await Note.find(searchObject)
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
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
}

export const findRandomNotesAndPopulate = async function (
  searchObject,
  limit = null
) {
  const random_notes = await Note.aggregate([
    { $sample: { size: pageSize } },
  ]).exec()

  await Note.populate(random_notes, { path: 'author' })
  await Note.populate(random_notes, { path: 'ideas' })
  await Note.populate(random_notes, { path: 'piles' })
  return await Note.populate(random_notes, {
    path: 'work',
    populate: {
      path: 'author',
    },
  })
}

export default defaultControllers(Note)
