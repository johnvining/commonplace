import Note from '../note/note.model.js'
import { Auth } from './auth.model.js'
import Work from '../work/work.model.js'
import { findNotesAndPopulate } from '../note/note.controllers.js'
import { defaultControllers } from '../../utils/default.controllers.js'

export const reqGetNotesForAuthor = async (req, res) => {
  const doc = await findNotesAndPopulate(
    { author: authId },
    { updatedAt: -1 },
    slim
  )
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const getNotesForAuthor = async function(authId, slim = false) {
  return
}

export const getAutoCompleteWithCounts = async (req, res) => {
  return getAutoComplete(req, res, true)
}

export const getAutoComplete = async (req, res, withCounts = false) => {
  const doc = await findAuthorsByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const findAuthorsByString = async function(str, withCounts) {
  let authors = await Auth.find({ name: new RegExp(str, 'i') })
    .lean()
    .exec()
  if (!withCounts) {
    return authors
  } else {
    let notePromises = [],
      workPromises = []
    authors.map(author => {
      notePromises.push(Note.find({ author: author._id }).countDocuments())
      workPromises.push(Work.find({ author: author._id }).countDocuments())
    })

    let noteFiler = Promise.all(notePromises).then(result => {
      result.map((val, idx) => {
        authors[idx] = { ...authors[idx], note_count: val }
      })
    })
    let workFiler = Promise.all(workPromises).then(result => {
      result.map((val, idx) => {
        authors[idx] = { ...authors[idx], work_count: val }
      })
    })

    await Promise.all([noteFiler, workFiler])
    return authors
  }
}

export const reqCreateAuthor = async (req, res) => {
  const doc = await createAuthor(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetWorksForAuthor = async (req, res) => {
  const doc = await Work.find({ author: req.params.id })
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeleteAuthor = async (req, res) => {
  await deleteAuthor(req.params.id)
}

export const createAuthor = async function(name) {
  return await Auth.create({ name: name })
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

export const deleteAuthor = async function(id) {
  let notes = await getNotesForAuthor(id, true)
  let deletionPromises = []
  notes.map(note => {
    deletionPromises.push(updateNote(note._id, { author: null }))
  })

  await Promise.all(deletionPromises)
  await Auth.findOneAndDelete({ _id: id })
}

export default defaultControllers(Auth)
