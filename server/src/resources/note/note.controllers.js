import Note from './note.model.js'
import { crudControllers } from '../../utils/crud.js'
import Idea from '../idea/idea.model.js'
import * as IdeaControllers from '../idea/idea.controllers.js'

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
      .lean()
      .exec()

    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const addTopic = async (req, res) => {
  console.log(req)

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
      .end() // TODO: return value here?
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const addTopicToID = async (noteID, topicID) => {
  console.log('adding topic to id' + noteID + ' ' + topicID)
  // TODO: Doesn't update until closing the program sometimes?
  return await Note.findOneAndUpdate(
    { _id: noteID },
    { $addToSet: { ideas: topicID } }
  )
    .lean()
    .exec()
}

export const updateNote = async (noteID, updateObj) => {
  return await Note.findOneAndUpdate({ _id: noteID }, updateObj, { new: true })
    .lean()
    .exec()
}

export default crudControllers(Note)
