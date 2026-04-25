import Note from '../note/note.model.js'
import { Auth } from './auth.model.js'
import Work from '../work/work.model.js'
import { findNotesAndPopulate, updateNote } from '../note/note.controllers.js'
import { defaultControllers } from '../../utils/default.controllers.js'

export const reqGetNotesForAuthor = async (req, res) => {
  const doc = await findNotesAndPopulate(
    { author: req.params.id },
    { updatedAt: -1 }
  )
  if (!doc) {
    return res.status(400).end()
  }
  return doc
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

export const findAuthorByUrl = async function (url) {
  try {
    const parsed = new URL(url)
    const candidates = new Set()

    // subdomain: username.substack.com, username.github.io
    const hostParts = parsed.hostname.split('.')
    if (hostParts.length > 2 && hostParts[0] !== 'www') {
      candidates.add(hostParts[0].toLowerCase())
    }

    // first path segment: /username or /@username
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      candidates.add(segments[0].replace(/^@/, '').toLowerCase())
    }

    if (candidates.size === 0) return null

    const escaped = [...candidates].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return await Auth.findOne({
      usernames: { $elemMatch: { $regex: new RegExp(`^(${escaped.join('|')})$`, 'i') } }
    }).lean()
  } catch {
    return null
  }
}

export const findAuthorsByString = async function (str, withCounts) {
  let authors = await Auth.find({ name: new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
    .lean()
    .exec()
  if (!withCounts) {
    return authors
  } else {
    let notePromises = [],
      workPromises = []
    authors.map((author) => {
      notePromises.push(Note.find({ author: author._id }).countDocuments())
      workPromises.push(Work.find({ author: author._id }).countDocuments())
    })

    let noteFiler = Promise.all(notePromises).then((result) => {
      result.map((val, idx) => {
        authors[idx] = { ...authors[idx], note_count: val }
      })
    })
    let workFiler = Promise.all(workPromises).then((result) => {
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
  const doc = await Work.find({ author: req.params.id }).sort({ year: 1 })
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeleteAuthor = async (req, res) => {
  await deleteAuthor(req.params.id)
}

export const createAuthor = async function (name) {
  return await Auth.create({ name: name })
}

export const findAuthorByString = async function (str) {
  return await Auth.findOne({ name: str }).exec()
}

export const findOrCreateAuthor = async function (name) {
  if (name == '') return
  // TODO: Can this be done with a single mongo call?
  const author = await findAuthorByString(name)

  if (author?._id != null) {
    return author
  }

  return await createAuthor(name)
}

export const deleteAuthor = async function (id) {
  let notes = await findNotesAndPopulate(
    { author: id },
    { updatedAt: -1 },
    true
  )
  let deletionPromises = []
  notes.map((note) => {
    deletionPromises.push(updateNote(note._id, { author: null }))
  })

  await Promise.all(deletionPromises)
  await Auth.findOneAndDelete({ _id: id })
}

export default defaultControllers(Auth)
