import Note from '../note/note.model.js'
import { Auth } from './auth.model.js'

export const getAuthorDetails = async (req, res) => {
  try {
    const doc = await Auth.findOne({ _id: req.params.id })
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

export const getNotesFromAuthor = async (req, res) => {
  try {
    const doc = await Note.find({ author: req.params.id })
      .sort({ updatedAt: -1 })
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
    const doc = await findAuthorsByString(req.body.string)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}
// TODO: DRY
export const reqCreateAuthor = async (req, res) => {
  try {
    const doc = await createAuthor(req.body.name)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

// Author
export const createAuthor = async function(name) {
  return await Auth.create({ name: name })
}

export const findAuthorsByString = async function(str) {
  return await Auth.find({ name: new RegExp(str, 'i') }).exec() // TODO when to use exec
}

export const findAuthorByString = async function(str) {
  return await Auth.findOne({ name: str }).exec()
}

export const findOrCreateAuthor = async function(name) {
  if (name == '') return
  // TODO: Can this be done with a single mongo call?
  const author = await findAuthorByString(name)

  if (author?._id != null) {
    return author
  }

  return await createAuthor(name)
}
