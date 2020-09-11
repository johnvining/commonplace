import Note from './note.model.js'
import { crudControllers } from '../../utils/crud.js'
import * as IdeaControllers from '../idea/idea.controllers.js'
import * as WorkControllers from '../work/work.controllers.js'
import config from '../../config'

export const createNote = async function(title, author) {
  return await Note.create({ title: title, author: author })
}

export const createNoteObj = async function(obj) {
  return await Note.create(obj)
}

export const addAuthor = async function(id, author) {
  return await Note.findOneAndUpdate({ _id: id }, { author: author })
}

// TODO: Standardize note-fetching so all note lists have the same fields populated #36
export const getRecentNotes = async (req, res) => {
  const pageSize = 30
  try {
    const docs = await Note.find({})
      .sort({ updatedAt: -1 })
      .skip((req.params.skip - 1) * pageSize)
      .limit(pageSize)
      .populate('author')
      .populate('ideas')
      .populate({
        path: 'work',
        populate: {
          path: 'author'
        }
      })
      .lean()
      .exec()

    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const addTopic = async (req, res) => {
  try {
    const docs = await addTopicToID(req.params.id, req.body.newTopic)
    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const addNewTopic = async (req, res) => {
  try {
    const newTopic = await IdeaControllers.createIdea(req.body.newTopic)
    const docs = await addTopicToID(req.params.id, newTopic._id)
    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqUpdateNote = async (req, res) => {
  try {
    const docs = await updateNote(req.params.id, req.body)
    res
      .status(200)
      .json(docs)
      .end()
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const addWork = async (req, res) => {
  try {
    const docs = await addWorkToID(req.params.id, req.body.newWork)
    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const addNewWork = async (req, res) => {
  try {
    const newWork = await WorkControllers.createWork(req.body.newWork)
    const docs = await addWorkToID(req.params.id, newWork._id)
    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqFindNotesByString = async (req, res) => {
  try {
    const docs = await findNotesByString(req.body.searchString)

    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

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

export const reqGetImageForNote = async function(req, res) {
  try {
    let note = await Note.findOne({ _id: req.params.id })
    res.sendFile(config.imageStorePath + '/' + note.images[req.params.image])
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqRemoveIdeaFromNote = async (req, res) => {
  try {
    const docs = await removeIdeaFromNote(req.params.id, req.params.ideaId)

    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const removeIdeaFromNote = async (noteId, ideaId) => {
  return await Note.findOneAndUpdate(
    { _id: noteId },
    { $pull: { ideas: ideaId } },
    { new: true }
  )
    .populate('ideas')
    .lean()
    .exec()
}

export const findNotesByString = async searchString => {
  return Note.find({ $text: { $search: '"' + searchString + '"' } })
    .populate('author')
    .populate('ideas')
    .populate({
      path: 'work',
      populate: {
        path: 'author'
      }
    })
    .lean()
    .exec()
}

export const addTopicToID = async (noteId, topicID) => {
  return await Note.findOneAndUpdate(
    { _id: noteId },
    { $addToSet: { ideas: topicID } },
    { new: true }
  )
    .populate('ideas')
    .lean()
    .exec()
}

export const addWorkToID = async (noteId, workID) => {
  return await Note.findOneAndUpdate({ _id: noteId }, { work: workID })
    .lean()
    .exec()
}

export const updateNote = async (noteId, updateObj) => {
  return await Note.findOneAndUpdate({ _id: noteId }, updateObj, { new: true })
    .populate('author')
    .populate('ideas')
    .populate({
      path: 'work',
      populate: {
        path: 'author'
      }
    })
    .lean()
    .exec()
}

export default crudControllers(Note)
