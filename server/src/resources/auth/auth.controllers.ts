import Note from '../note/note.model.js'
import { Auth } from './auth.model.js'
import Work from '../work/work.model.js'
import { findNotesAndPopulate, updateNote } from '../note/note.controllers.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import { runCascadeSteps } from '../../utils/cascadeDelete.js'
import { escapeRegexInput } from '../../utils/searchInput.js'
import { pageParams } from '../../utils/pagination.js'
import type { Request, Response } from 'express'


export const reqGetNotesForAuthor = async (req: Request, res: Response) => {
  const { skip, limit } = pageParams(req)
  const doc = await findNotesAndPopulate(
    { author: req.params.id },
    { updatedAt: -1 },
    false,
    skip,
    limit
  )
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetAllNotesForAuthor = async (req: Request, res: Response) => {
  const { skip, limit } = pageParams(req)
  const authorId = req.params.id
  const works = await Work.find({ author: authorId }, { _id: 1 }).lean().exec()
  const workIds = works.map(w => w._id)
  const query = workIds.length
    ? { $or: [{ author: authorId }, { work: { $in: workIds } }] }
    : { author: authorId }
  return findNotesAndPopulate(query, { updatedAt: -1 }, false, skip, limit)
}

export const getAutoCompleteWithCounts = async (req: Request, res: Response) => {
  return getAutoComplete(req, res, true)
}

export const getAutoComplete = async (req: Request, res: Response, withCounts = false) => {
  const doc = await findAuthorsByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const findAuthorByUrl = async function (url: string) {
  try {
    const parsed = new URL(url)
    const candidates = new Set<string>()

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
    const matches = await Auth.find({
      usernames: { $elemMatch: { $regex: new RegExp(`^(${escaped.join('|')})$`, 'i') } }
    }).limit(2).lean()
    return matches.length === 1 ? matches[0] : null
  } catch {
    return null
  }
}

export const findAuthorsByString = async function (str: string, withCounts: boolean) {
  const authors = await Auth.find({ name: new RegExp(escapeRegexInput(str), 'i') })
    .lean()
    .exec()
  if (!withCounts || !authors.length) return authors

  const authorIds = authors.map(a => a._id)
  const [noteCounts, workCounts] = await Promise.all([
    Note.aggregate([
      { $match: { author: { $in: authorIds } } },
      { $group: { _id: '$author', count: { $sum: 1 } } },
    ]),
    Work.aggregate([
      { $match: { author: { $in: authorIds } } },
      { $group: { _id: '$author', count: { $sum: 1 } } },
    ]),
  ])
  const noteMap = Object.fromEntries(noteCounts.map(x => [String(x._id), x.count]))
  const workMap = Object.fromEntries(workCounts.map(x => [String(x._id), x.count]))
  return authors.map(a => ({
    ...a,
    note_count: noteMap[String(a._id)] || 0,
    work_count: workMap[String(a._id)] || 0,
  }))
}

export const reqCreateAuthor = async (req: Request, res: Response) => {
  const doc = await createAuthor(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetWorksForAuthor = async (req: Request, res: Response) => {
  const doc = await Work.find({ author: req.params.id }).sort({ year: 1 })
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeleteAuthor = async (req: Request, res: Response) => {
  await deleteAuthor(String(req.params.id))
}

export const createAuthor = async function (name: string) {
  return await Auth.create({ name: name })
}

export const findAuthorByString = async function (str: string) {
  return await Auth.findOne({ name: str }).exec()
}

export const findOrCreateAuthor = async function (name: string) {
  if (name == '') return
  // TODO: Can this be done with a single mongo call?
  const author = await findAuthorByString(name)

  if (author?._id != null) {
    return author
  }

  return await createAuthor(name)
}

export const deleteAuthor = async function (id: string) {
  const notes = await findNotesAndPopulate(
    { author: id },
    { updatedAt: -1 },
    true
  )
  const steps: Array<() => Promise<unknown>> = notes.map(
    (note) => () => updateNote(note._id, { author: null })
  )
  // Author has no nick so nothing to drop on that side.
  await runCascadeSteps('deleteAuthor', steps)
  await Auth.findOneAndDelete({ _id: id })
}

const AUTH_WRITABLE = ['name', 'birth_year', 'death_year', 'usernames'] as const
export default defaultControllers(Auth, { writable: AUTH_WRITABLE })
