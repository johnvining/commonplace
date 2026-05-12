import Idea from './idea.model.js'
import Note from '../note/note.model.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import { generateNick } from '../nick/nick.controllers.js'
import {
  removeIdeaFromNote,
  findNotesAndPopulate
} from '../note/note.controllers'
import { deleteNickFor } from '../nick/nick.controllers.js'
import { runCascadeSteps } from '../../utils/cascadeDelete.js'
import { escapeRegexInput } from '../../utils/searchInput.js'
import { pageParams } from '../../utils/pagination.js'
import type { Request, Response } from 'express'

export const reqGetNotesForIdea = async (req: Request, res: Response) => {
  const { skip, limit } = pageParams(req)
  const doc = await findNotesAndPopulate(
    { ideas: req.params.id },
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

export const reqGetAutoCompleteWithCounts = async (req: Request, res: Response) => {
  return await reqGetAutoComplete(req, res, true)
}

export const reqGetAutoComplete = async (req: Request, res: Response, withCounts = false) => {
  const doc = await findIdeasByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const findIdeasByString = async function(string: string, withCounts = false) {
  const ideas = await Idea.find({ name: new RegExp(escapeRegexInput(string), 'i') })
    .lean()
    .exec()
  if (!withCounts || !ideas.length) return ideas

  const ideaIds = ideas.map(i => i._id)
  const noteCounts = await Note.aggregate([
    { $match: { ideas: { $in: ideaIds } } },
    { $unwind: '$ideas' },
    { $match: { ideas: { $in: ideaIds } } },
    { $group: { _id: '$ideas', count: { $sum: 1 } } },
  ])
  const noteMap = Object.fromEntries(noteCounts.map(x => [String(x._id), x.count]))
  return ideas.map(i => ({ ...i, note_count: noteMap[String(i._id)] || 0 }))
}

export const reqCreateIdea = async (req: Request, res: Response) => {
  const doc = await createIdea(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeleteIdea = async (req: Request, res: Response) => {
  await deleteIdea(String(req.params.id))
}

// Idea
export const createIdea = async function(name: string) {
  const idea = await Idea.create({ name: name })
  generateNick('idea', idea._id).catch(() => {})
  return idea
}

export const findIdeaByString = async function(string: string) {
  return await Idea.findOne({ name: string })
}

export const findOrCreateIdea = async function(name: string) {
  if (name == '') return
  // TODO: Can this be done with a single mongo call?
  const idea = await findIdeaByString(name)

  if (idea?._id != null) {
    return idea
  }

  return await createIdea(name)
}

export const deleteIdea = async function(ideaId: string) {
  const notes = await findNotesAndPopulate({ ideas: ideaId }, {}, true)
  const steps: Array<() => Promise<unknown>> = notes.map(
    (note) => () => removeIdeaFromNote(note._id, ideaId)
  )
  steps.push(() => deleteNickFor('idea', ideaId))
  await runCascadeSteps('deleteIdea', steps)
  await Idea.findOneAndDelete({ _id: ideaId })
}

const IDEA_WRITABLE = ['name', 'start_year', 'end_year'] as const
export default defaultControllers(Idea, { writable: IDEA_WRITABLE })
