import Work from '../work/work.model.js'
import Note from '../note/note.model.js'
import Pile from '../pile/pile.model.js'
import { createAuthor, findAuthorByUrl } from '../auth/auth.controllers.js'
import { guessYearFromUrl } from '../../utils/urls.js'
import { findNotesAndPopulate, updateNote } from '../note/note.controllers.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import { generateNick, deleteNickFor } from '../nick/nick.controllers.js'
import { runCascadeSteps } from '../../utils/cascadeDelete.js'
import { escapeRegexInput } from '../../utils/searchInput.js'
import { pageParams } from '../../utils/pagination.js'
import { pickAllowed } from '../../utils/pickAllowed.js'
import type { Request, Response } from 'express'

const WORK_WRITABLE = [
  'name', 'authors', 'url', 'year', 'citation_information', 'summary', 'piles',
] as const


// Request response
export const reqGetNotesForWork = async (req: Request, res: Response) => {
  const { skip, limit } = pageParams(req)
  const doc = await findNotesAndPopulate({ work: req.params.id }, {}, false, skip, limit)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetWorkInfo = async (req: Request, res: Response) => {
  const doc = await getWorkInfo(req.params.id)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqCreateWork = async (req: Request, res: Response) => {
  const doc = await createWork(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqUpdateWork = async (req: Request, res: Response) => {
  const updates: Record<string, unknown> = pickAllowed(req.body, WORK_WRITABLE)

  const url = typeof updates.url === 'string' ? updates.url : null
  if (url) {
    const existing = await Work.findById(req.params.id).lean()
    // Only infer authors from URL if the caller didn't already set them and
    // the work had none before. Don't clobber a deliberate choice.
    const incomingAuthors = Array.isArray(updates.authors) ? updates.authors : null
    if (existing && !existing.authors?.length && !incomingAuthors?.length) {
      const author = await findAuthorByUrl(url)
      if (author) updates.authors = [author._id]
    }
    if (!updates.year) {
      const year = guessYearFromUrl(url)
      if (year) updates.year = year
    }
  }

  const doc = await updateWorkInfo(req.params.id, updates)
  if (!doc) return res.status(400).end()
  return doc
}

export const reqCreateAndAddAuth = async (req: Request, res: Response) => {
  const newAuth = await createAuthor(req.body.name)
  // Append to existing authors rather than overwrite — matches the
  // multi-author model.
  const doc = await Work.findOneAndUpdate(
    { _id: req.params.id },
    { $addToSet: { authors: newAuth._id } },
    { new: true }
  ).lean().exec()
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeleteWork = async (req: Request, res: Response) => {
  await deleteWork(req.params.id)
}

export const reqAddPile = async (req: Request, res: Response) => {
  const doc = await addPileToId(req.params.id, req.body.id)
  return doc
}

export const reqAddNewPile = async (req: Request, res: Response) => {
  const newPile = await Pile.create({ name: req.body.name })
  generateNick('pile', newPile._id).catch(() => {})
  const doc = await addPileToId(req.params.id, newPile._id)
  return doc
}

export const reqGetAutoCompleteWithCounts = async (req: Request, res: Response) => {
  return await reqAutocompleteOnName(req, res, true)
}

export const reqAutocompleteOnName = async (req: Request, res: Response, withCounts = false) => {
  const doc = await findWorksByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqRemovePileFromWork = async (req: Request, res: Response) => {
  const doc = await removePileFromWork(req.params.id, req.params.pileId)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const findWorksByString = async function(string: string, withCounts = false) {
  const works = await Work.find({ name: new RegExp(escapeRegexInput(string), 'i') })
    .populate('authors')
    .lean()
    .exec()
  if (!withCounts || !works.length) return works

  const workIds = works.map(w => w._id)
  const noteCounts = await Note.aggregate([
    { $match: { work: { $in: workIds } } },
    { $group: { _id: '$work', count: { $sum: 1 } } },
  ])
  const noteMap = Object.fromEntries(noteCounts.map(x => [String(x._id), x.count]))
  return works.map(w => ({ ...w, note_count: noteMap[String(w._id)] || 0 }))
}

export const createWork = async function(name: string) {
  const work = await Work.create({ name: name })
  generateNick('work', work._id).catch(() => {})
  return work
}

export const getWorkInfo = async function(workId: string) {
  const results = await Work.findOne({ _id: workId })
    .populate('authors')
    .populate('piles')
    .lean()
    .exec()
  return results
}

export const updateWorkInfo = async function(workId: string, updateObject: object) {
  return await Work.findOneAndUpdate({ _id: workId }, updateObject)
}

export const findWorkByString = async function(name: string) {
  return await Work.findOne({ name: name }).exec()
}

export const findOrCreateWork = async function(name: string) {
  if (name == '') return null
  // TODO: Can this be done with a single mongo call?
  const work = await findWorkByString(name)
  if (work?._id != null) {
    return work
  }

  return await createWork(name)
}

export const deleteWork = async function(id: string) {
  const notes = await findNotesAndPopulate({ work: id }, {}, true)
  const steps: Array<() => Promise<unknown>> = notes.map(
    (note) => () => updateNote(note._id, { work: null })
  )
  steps.push(() => deleteNickFor('work', id))
  await runCascadeSteps('deleteWork', steps)
  await Work.findOneAndDelete({ _id: id })
}

export const addPileToId = async (workId: string, pileId: unknown) => {
  const doc = await Work.findOneAndUpdate(
    { _id: workId },
    { $addToSet: { piles: pileId } },
    { new: true }
  )
    .populate('piles')
    .lean()
    .exec()
  await touchPile(pileId)
  return doc
}

export const removePileFromWork = async (workId: string, pileId: unknown) => {
  const doc = await Work.findOneAndUpdate(
    { _id: workId },
    { $pull: { piles: pileId } },
    { new: true }
  )
    .lean()
    .exec()
  await touchPile(pileId)
  return doc
}

export default defaultControllers(Work, { writable: WORK_WRITABLE })

const touchPile = async (pileId: unknown) => {
  if (!pileId) return
  await Pile.findByIdAndUpdate(pileId, { $set: { updatedAt: new Date() } })
}
