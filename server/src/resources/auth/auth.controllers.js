import Note from '../note/note.model.js'
import { Auth } from './auth.model.js'

export const getAuthorDetails = async (req, res) => {
  console.log('Get author details')
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
  console.log('uthor get one ' + req.params.id)
  try {
    const doc = await Note.find({ author: req.params.id })
      .sort({ updatedAt: -1 })
      .populate('author')
      .populate('ideas')
      .populate('work')
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
  console.log('Looking for authors with str: ' + str)
  // TODO: Set a minimum length
  return await Auth.find({ name: new RegExp(str, 'i') }).exec() // TODO when to use exec
}
