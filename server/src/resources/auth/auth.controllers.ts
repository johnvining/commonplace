import Note from '../note/note.model.js'
import { Auth } from './auth.model.js'
import Work from '../work/work.model.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import { rankByName, wordPrefixFilter } from '../../utils/searchInput.js'
import { findEntityNotesPage } from '../../utils/pagination.js'
import { withNoteCounts } from '../../utils/noteCounts.js'
import { deleteEntity } from '../../utils/deleteEntity.js'
import { mergeAuthors, planOptionsFrom, respondWithPlan, splitAuthor } from '../../utils/merge.js'
import type { Request, Response } from 'express'


export const reqGetNotesForAuthor = async (req: Request, res: Response) => {
  return findEntityNotesPage(req, res, { authors: req.params.id }, { updatedAt: -1 })
}

// Notes about this person, as opposed to notes they wrote (#246).
export const reqGetNotesAboutAuthor = async (req: Request, res: Response) => {
  return findEntityNotesPage(req, res, { people: req.params.id }, { updatedAt: -1 })
}

export const reqGetAllNotesForAuthor = async (req: Request, res: Response) => {
  const authorId = req.params.id
  const works = await Work.find({ authors: authorId }, { _id: 1 }).lean().exec()
  const workIds = works.map(w => w._id)
  const query = workIds.length
    ? { $or: [{ authors: authorId }, { work: { $in: workIds } }] }
    : { authors: authorId }
  return findEntityNotesPage(req, res, query, { updatedAt: -1 })
}

export const getAutoCompleteWithCounts = async (req: Request, res: Response) => {
  return getAutoComplete(req, res, true)
}

export const getAutoComplete = async (req: Request, res: Response, withCounts = false) => {
  const doc = await findAuthorsByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).json({ message: 'Author search failed' })
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
  const authors = rankByName(
    await Auth.find(wordPrefixFilter('name', str)).lean().exec(),
    str
  )
  if (!withCounts || !authors.length) return authors

  const authorIds = authors.map(a => a._id)
  // Notes and Works carry an authors[] array. The initial $match narrows on
  // the indexed array field, then $unwind explodes one row per (doc, author)
  // pair, and the second $match drops authors that weren't in our target set
  // for docs that have multiple authors.
  const [noteCounts, workCounts] = await Promise.all([
    Note.aggregate([
      { $match: { authors: { $in: authorIds } } },
      { $unwind: '$authors' },
      { $match: { authors: { $in: authorIds } } },
      { $group: { _id: '$authors', count: { $sum: 1 } } },
    ]),
    Work.aggregate([
      { $match: { authors: { $in: authorIds } } },
      { $unwind: '$authors' },
      { $match: { authors: { $in: authorIds } } },
      { $group: { _id: '$authors', count: { $sum: 1 } } },
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
    return res.status(400).json({ message: 'Could not create the author' })
  }
  return doc
}

export const reqGetWorksForAuthor = async (req: Request, res: Response) => {
  const works = await Work.find({ authors: req.params.id })
    .populate('authors')
    .populate('piles')
    .populate('ideas')
    .sort({ year: 1 })
    .lean()
    .exec()
  return withNoteCounts(works)
}

// POST /auth/:id/merge { into, dryRun }: fold this author into `into` (#360)
export const reqMergeAuthor = async (req: Request, res: Response) =>
  respondWithPlan(res, () => mergeAuthors(String(req.params.id), String(req.body.into), planOptionsFrom(req.body)))

// Works this person edited or translated, credited apart from the works
// they wrote (#358).
export const reqGetCreditsForAuthor = async (req: Request, res: Response) => {
  const find = (field: string) =>
    Work.find({ [field]: req.params.id })
      .populate('authors')
      .sort({ year: 1 })
      .lean()
      .exec()
      .then(withNoteCounts)
  const [edited, translated] = await Promise.all([find('editors'), find('translators')])
  return { edited, translated }
}

// POST /auth/:id/split { names, keep, dryRun }: one author per name (#356)
export const reqSplitAuthor = async (req: Request, res: Response) =>
  respondWithPlan(res, () =>
    splitAuthor(String(req.params.id), req.body.names, { keep: Boolean(req.body.keep), ...planOptionsFrom(req.body) }))

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
  if (!name?.trim()) return
  // TODO: Can this be done with a single mongo call?
  const author = await findAuthorByString(name)

  if (author?._id != null) {
    return author
  }

  return await createAuthor(name)
}

export const deleteAuthor = (id: string) => deleteEntity('auth', id)

const AUTH_WRITABLE = ['name', 'birth_year', 'death_year', 'usernames'] as const
export default defaultControllers(Auth, { writable: AUTH_WRITABLE })
