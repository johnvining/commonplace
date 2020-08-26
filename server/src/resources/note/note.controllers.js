import Note from './note.model.js'
import { crudControllers } from '../../utils/crud.js'
import Idea from '../idea/idea.model.js'
import * as IdeaControllers from '../idea/idea.controllers.js'
import * as WorkControllers from '../work/work.controllers.js'

// Note
export const createNote = async function(title, author) {
  return await Note.create({ title: title, author: author })
}

export const addAuthor = async function(id, author) {
  return await Note.findOneAndUpdate({ _id: id }, { author: author })
}

export const getTenMostRecentNotes = async (req, res) => {
  console.log('Ten most recent notes')
  try {
    console.log('h2')
    const docs = await Note.find({})
      .sort({ updatedAt: -1 })
      .limit(30)
      .populate('author')
      .populate('ideas')
      .populate('work')
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
  console.log(req.params.id, req.body)
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

export const findNotesByString = async searchString => {
  return Note.find({ $text: { $search: searchString } })
    .populate('author')
    .lean()
    .exec()
}

export const addTopicToID = async (noteID, topicID) => {
  return await Note.findOneAndUpdate(
    { _id: noteID },
    { $addToSet: { ideas: topicID } },
    { new: true }
  )
    .populate('ideas')
    .lean()
    .exec()
}

export const addWorkToID = async (noteID, workID) => {
  return await Note.findOneAndUpdate({ _id: noteID }, { work: workID })
    .lean()
    .exec()
}

export const updateNote = async (noteID, updateObj) => {
  return await Note.findOneAndUpdate({ _id: noteID }, updateObj, { new: true })
    .lean()
    .exec()
}

export default crudControllers(Note)
