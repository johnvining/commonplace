import Idea from './idea.model.js'
import Note from '../note/note.model.js'
import { crudControllers } from '../../utils/crud.js'
import { removeIdeaFromNote } from '../note/note.controllers'

export const getNotesFromIdea = async (req, res) => {
  try {
    const doc = await getNotesForIdea(req.params.id)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetIdeasByStringWithCounts = async (req, res) => {
  try {
    var doc = await findIdeasByString(req.body.string)
    if (!doc) {
      return res.status(400).end()
    }

    // TODO: Refactor note from idea search out
    var notePromises = []
    for (let i = 0; i < doc.length; i++) {
      notePromises.push(
        Note.find({ ideas: doc[i]._id })
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
      )
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

export const getAutoCompleteWithCounts = async (req, res) => {
  return await reqGetAutoComplete(req, res, true)
}

export const reqGetAutoComplete = async (req, res, withCounts = false) => {
  try {
    const doc = await findIdeasByString(req.body.string, withCounts)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
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
  try {
    const doc = await getIdeaInfo(req.params.id)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqCreateIdea = async (req, res) => {
  try {
    const doc = await createIdea(req.body.name)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqDeleteIdea = async (req, res) => {
  try {
    await deleteIdea(req.params.id)
    res.status(200).json()
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
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
  if (slim) {
    return Note.find({ ideas: ideaId })
      .lean()
      .exec()
  } else {
    return Note.find({ ideas: ideaId })
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

export default crudControllers(Idea)
