import Note from './note.model.js'
import { crudControllers } from '../../utils/crud.js'
import Idea from '../idea/idea.model.js'
import * as IdeaControllers from '../idea/idea.controllers.js'
import * as WorkControllers from '../work/work.controllers.js'

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
  try {
    const docs = await Note.find({})
      .sort({ updatedAt: -1 })
      .limit(100)
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
    .lean()
    .exec()
}

export default crudControllers(Note)
