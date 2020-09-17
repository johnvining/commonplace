import Note from '../note/note.model.js'
import { Auth } from './auth.model.js'
import Work from '../work/work.model.js'
import { removeAuthorFromNote } from '../note/note.controllers.js'

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
    const doc = await getNotesForAuthor(req.params.id)
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

export const reqGetWorksForAuthor = async (req, res) => {
  try {
    const doc = await Work.find({ author: req.params.id })
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqDeleteAuthor = async (req, res) => {
  try {
    await deleteAuthor(req.params.id)
    res.status(200).json()
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

export const getNotesForAuthor = async function(authId, slim = false) {
  if (slim) {
    return Note.find({ author: authId })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
  } else {
    return Note.find({ author: authId })
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
  }
}

export const deleteAuthor = async function(id) {
  let notes = await getNotesForAuthor(id, true)
  let deletionPromises = []
  notes.map(note => {
    deletionPromises.push(removeAuthorFromNote(note._id))
  })

  await Promise.all(deletionPromises)
  await Auth.findOneAndDelete({ _id: id })
}
