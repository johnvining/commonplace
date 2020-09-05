import Idea from './idea.model.js'
import Note from '../note/note.model.js'

export const getNotesFromIdea = async (req, res) => {
  try {
    const doc = await Note.find({ ideas: req.params.id })
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
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const getAutoComplete = async (req, res) => {
  try {
    const doc = await findIdeasByString(req.body.string)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const getIdeasByStringWithNotes = async (req, res) => {
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

// Idea
export const createIdea = async function(name) {
  return await Idea.create({ name: name })
}

export const findIdeasByString = async function(str) {
  return await Idea.find({ name: new RegExp(str, 'i') }).exec()
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
  let idea = await findIdeaByString(name)
  if (!idea) {
    idea = await createIdea(name)
  }

  return idea
}
