import Note from './note.model.js'
import Pile from '../pile/pile.model.js'
import { crudControllers } from '../../utils/crud.js'
import * as IdeaControllers from '../idea/idea.controllers.js'
import * as WorkControllers from '../work/work.controllers.js'
import config from '../../config'
import fs from 'fs'

export const reqFindNotesByString = async (req, res) => {
  return await findNotesByString(req.body.searchString)
}

// TODO: Standardize note-fetching so all note lists have the same fields populated #36
export const reqGetRecentNotes = async (req, res) => {
  const pageSize = 30
  return await Note.find({})
    .sort({ updatedAt: -1 })
    .skip((req.params.skip - 1) * pageSize)
    .limit(pageSize)
    .populate('author')
    .populate('ideas')
    .populate('piles')
    .populate({
      path: 'work',
      populate: {
        path: 'author'
      }
    })
    .lean()
    .exec()
}

export const reqAddIdea = async (req, res) => {
  return await addIdeaToId(req.params.id, req.body.id)
}

export const reqAddNewIdea = async (req, res) => {
  const newIdea = await IdeaControllers.createIdea(req.body.name)
  return await addIdeaToId(req.params.id, newIdea._id)
}

export const reqRemoveIdeaFromNote = async (req, res) => {
  return await removeIdeaFromNote(req.params.id, req.params.ideaId)
}

export const reqAddPile = async (req, res) => {
  return await addPileToId(req.params.id, req.body.id)
}

export const reqAddNewPile = async (req, res) => {
  const newPile = await Pile.create({ name: req.body.name })
  return await addPileToId(req.params.id, newPile._id)
}

export const reqRemovePileFromNote = async (req, res) => {
  const doc = removePileFromNote(req.params.id, req.params.pileId)
  if (!doc) {
    return res.status(400).end() // TODO: Test with wrapper
  }
  return doc
}

export const reqAddWork = async (req, res) => {
  return await addWorkToId(req.params.id, req.body.newWork)
}

export const reqAddNewWork = async (req, res) => {
  const newWork = await WorkControllers.createWork(req.body.newWork)
  return await addWorkToId(req.params.id, newWork._id)
}

export const reqUpdateNote = async (req, res) => {
  return await updateNote(req.params.id, req.body)
}

// TODO: Create specific file for nome.image.controllers
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
          newNote
        }
      })
    }
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqRemoveImageFromNote = async function(req, res) {
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

export const reqGetImageForNote = async function(req, res) {
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

export const findNotesByString = async searchString => {
  return Note.find({ $text: { $search: '"' + searchString + '"' } })
    .populate('author')
    .populate('ideas')
    .populate('piles')
    .populate({
      path: 'work',
      populate: {
        path: 'author'
      }
    })
    .lean()
    .exec()
}

export const addWorkToId = async (noteId, workId) => {
  return await Note.findOneAndUpdate({ _id: noteId }, { work: workId })
    .lean()
    .exec()
}

export const updateNote = async (noteId, updateObj) => {
  return await Note.findOneAndUpdate({ _id: noteId }, updateObj, { new: true })
    .populate('author')
    .populate('ideas')
    .populate('piles')
    .populate({
      path: 'work',
      populate: {
        path: 'author'
      }
    })
    .lean()
    .exec()
}

export const addIdeaToId = async (noteId, ideaId) => {
  return await Note.findOneAndUpdate(
    { _id: noteId },
    { $addToSet: { ideas: ideaId } },
    { new: true }
  )
    .populate('ideas')
    .lean()
    .exec()
}

export const addPileToId = async (noteId, pileId) => {
  return await Note.findOneAndUpdate(
    { _id: noteId },
    { $addToSet: { piles: pileId } },
    { new: true }
  )
    .populate('author')
    .populate('ideas')
    .populate('piles')
    .populate({
      path: 'work',
      populate: {
        path: 'author'
      }
    })
    .lean()
    .exec()
}

export const removeIdeaFromNote = async (noteId, ideaId) => {
  return await Note.findOneAndUpdate(
    { _id: noteId },
    { $pull: { ideas: ideaId } },
    { new: true }
  )
    .populate('author')
    .populate('ideas')
    .populate('piles')
    .populate({
      path: 'work',
      populate: {
        path: 'author'
      }
    })
    .lean()
    .exec()
}

export const removeWorkFromNote = async noteId => {
  return await Note.findOneAndUpdate({ _id: noteId }, { work: null })
}

export const removeAuthorFromNote = async noteId => {
  return await Note.findOneAndUpdate({ _id: noteId }, { author: null })
}

export const removePileFromNote = async (noteId, pileId) => {
  return await Note.findOneAndUpdate(
    { _id: noteId },
    { $pull: { piles: pileId } },
    { new: true }
  )
    .lean()
    .exec()
}

export const addAuthor = async function(id, author) {
  return await Note.findOneAndUpdate({ _id: id }, { author: author })
}

export const createNote = async function(title, author) {
  return await Note.create({ title: title, author: author })
}

export const createNoteObj = async function(obj) {
  return await Note.create(obj)
}

export default crudControllers(Note)
