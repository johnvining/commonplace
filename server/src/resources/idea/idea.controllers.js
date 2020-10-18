import Idea from './idea.model.js'
import Note from '../note/note.model.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import {
  removeIdeaFromNote,
  findNotesAndPopulate
} from '../note/note.controllers'

export const reqGetNotesForIdea = async (req, res) => {
  const doc = await getNotesForIdea(req.params.id)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetIdeasByStringWithCounts = async (req, res) => {
  try {
    var doc = await findIdeasByString(req.body.string)
    if (!doc) {
      return res.status(400).end()
    }

    // TODO: Can we use slim here?
    var notePromises = []
    for (let i = 0; i < doc.length; i++) {
      notePromises.push(findNotesAndPopulate({ ideas: doc[i]._id }))
    }

    const notes = await Promise.all(notePromises)

    var responseData = []
    for (let i = 0; i < doc.length; i++) {
      let idea = doc[i]._doc
      let notesValues = { notes: notes[i] }
      idea = { ...idea, ...notesValues }
      responseData[i] = idea
    }

    res.status(200).json({ data: responseData })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetAutoCompleteWithCounts = async (req, res) => {
  return await reqGetAutoComplete(req, res, true)
}

export const reqGetAutoComplete = async (req, res, withCounts = false) => {
  const doc = await findIdeasByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const findIdeasByString = async function(string, withCounts = false) {
  let ideas = await Idea.find({ name: new RegExp(string, 'i') })
    .lean()
    .exec()
  if (!withCounts) {
    return ideas
  } else {
    let notePromises = []
    ideas.map(idea => {
      notePromises.push(Note.find({ ideas: idea._id }).countDocuments())
    })

    await Promise.all(notePromises).then(result => {
      result.map((val, idx) => {
        ideas[idx] = { ...ideas[idx], note_count: val }
      })
    })

    return ideas
  }
}

export const reqGetIdeaInfo = async (req, res) => {
  const doc = await getIdeaInfo(req.params.id)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqCreateIdea = async (req, res) => {
  const doc = await createIdea(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeleteIdea = async (req, res) => {
  await deleteIdea(req.params.id)
}

// Idea
export const createIdea = async function(name) {
  return await Idea.create({ name: name })
}

export const getIdeaInfo = async function(ideaId) {
  return await Idea.findOne({ _id: ideaId }).exec()
}

export const findIdeaByString = async function(string) {
  return await Idea.findOne({ name: string })
}

export const findOrCreateIdea = async function(name) {
  if (name == '') return
  // TODO: Can this be done with a single mongo call?
  const idea = await findIdeaByString(name)

  if (idea?._id != null) {
    return idea
  }

  return await createIdea(name)
}

export const getNotesForIdea = async function(ideaId, slim = false) {
  return findNotesAndPopulate({ ideas: ideaId }, {}, slim)
}

export const deleteIdea = async function(ideaId) {
  let notes = await getNotesForIdea(ideaId, true)
  let deletionPromises = []
  notes.map(note => {
    deletionPromises.push(removeIdeaFromNote(note._id, ideaId))
  })

  await Promise.all(deletionPromises)
  await Idea.findOneAndDelete({ _id: ideaId })
}

export default defaultControllers(Idea)
