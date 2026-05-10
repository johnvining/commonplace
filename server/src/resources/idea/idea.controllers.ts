import Idea from './idea.model.js'
import Note from '../note/note.model.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import { generateNick } from '../nick/nick.controllers.js'
import {
  removeIdeaFromNote,
  findNotesAndPopulate
} from '../note/note.controllers'
import type { Request, Response } from 'express'

export const reqGetNotesForIdea = async (req: Request, res: Response) => {
  const doc = await findNotesAndPopulate({ ideas: req.params.id })
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetIdeasByStringWithCounts = async (req: Request, res: Response) => {
  try {
    var doc = await findIdeasByString(req.body.string)
    if (!doc) {
      return res.status(400).end()
    }

    // TODO: Can we use slim here?
    const notePromises: Promise<unknown[]>[] = []
    for (let i = 0; i < doc.length; i++) {
      notePromises.push(findNotesAndPopulate({ ideas: doc[i]._id }))
    }

    const notes = await Promise.all(notePromises)

    const responseData: any[] = []
    for (let i = 0; i < doc.length; i++) {
      let idea = (doc[i] as any)._doc
      let notesValues = { notes: notes[i] }
      idea = { ...idea, ...notesValues }
      responseData[i] = idea
    }

    res.status(200).json({ data: responseData })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetAutoCompleteWithCounts = async (req: Request, res: Response) => {
  return await reqGetAutoComplete(req, res, true)
}

export const reqGetAutoComplete = async (req, res, withCounts = false) => {
  const doc = await findIdeasByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const findIdeasByString = async function(string, withCounts = false) {
  let ideas = await Idea.find({ name: new RegExp(string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
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
  await deleteIdea(req.params.id)
}

// Idea
export const createIdea = async function(name) {
  const idea = await Idea.create({ name: name })
  generateNick('idea', idea._id).catch(() => {})
  return idea
}

export const findIdeaByString = async function(string) {
  return await Idea.findOne({ name: string })
}

export const findOrCreateIdea = async function(name) {
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
  const deletionPromises: Promise<unknown>[] = notes.map((note) =>
    removeIdeaFromNote(note._id, ideaId)
  )

  await Promise.all(deletionPromises)
  await Idea.findOneAndDelete({ _id: ideaId })
}

export default defaultControllers(Idea)
