import Idea from './idea.model.js'
import Note from '../note/note.model.js'

export const getNotesFromIdea = async (req, res) => {
  console.log('ideasnotes get one ' + req.params.id)
  try {
    const doc = await Note.find({ ideas: req.params.id })
      .populate('author')
      .populate('ideas')
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
  console.log(req.body.string)

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

// Idea
export const createIdea = async function(name) {
  return await Idea.create({ name: name })
}

export const findIdeasByString = async function(str) {
  return await Idea.find({ name: new RegExp(str, 'i') }).exec() // TODO when to use exec
}
