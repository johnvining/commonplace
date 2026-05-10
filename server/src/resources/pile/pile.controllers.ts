import Pile from './pile.model.js'
import Note from '../note/note.model.js'
import Work from '../work/work.model.js'
import { updateNote, findNotesAndPopulate } from '../note/note.controllers.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import { removePileFromWork } from '../work/work.controllers.js'
import { generateNick } from '../nick/nick.controllers.js'
import type { Request, Response } from 'express'


export const reqGetNotesForPile = async (req: Request, res: Response) => {
  const doc = await findNotesAndPopulate(
    { piles: req.params.id },
    { updatedAt: -1 }
  )
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetPileList = async (req: Request, res: Response) => {
  const doc = await findPiles({}, { name: 1 })
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetWorksForPile = async (req: Request, res: Response) => {
  const doc = await getWorksForPile(req.params.id)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetAutoCompleteWithCounts = async (req: Request, res: Response) => {
  return reqGetAutoComplete(req, res, true)
}

export const reqGetAutoComplete = async (req: Request, res: Response, withCounts = false) => {
  const doc = await filePilesByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqCreatePile = async (req: Request, res: Response) => {
  const doc = await findOrCreatePile(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeletePile = async (req: Request, res: Response) => {
  await deletePile(req.params.id)
}

// TODO: Duplicative of whats in work.controllers.js
export const filePilesByString = async function (string: string, withCounts: boolean) {
  let piles = await Pile.find({ name: new RegExp(string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
    .lean()
    .exec()
  if (!withCounts) {
    return piles
  } else {
    const notePromises: Promise<number>[] = []
    const workPromises: Promise<number>[] = []
    piles.map((pile) => {
      notePromises.push(Note.find({ piles: pile._id }).countDocuments().exec())
      workPromises.push(Work.find({ piles: pile._id }).countDocuments().exec())
    })

    let noteFiler = Promise.all(notePromises).then((result) => {
      result.map((val, idx) => {
        ;(piles as any)[idx] = { ...piles[idx], note_count: val }
      })
    })
    let workFiler = Promise.all(workPromises).then((result) => {
      result.map((val, idx) => {
        ;(piles as any)[idx] = { ...piles[idx], work_count: val }
      })
    })

    await Promise.all([noteFiler, workFiler])
    return piles
  }
}

export const deletePile = async function (pileId: string) {
  // TODO: Parallel
  const notes = await findNotesAndPopulate(
    { piles: pileId },
    { updatedAt: -1 },
    true
  )
  const works = await getWorksForPile(pileId)
  const deletionPromises: Promise<unknown>[] = []
  notes.map((note) => {
    deletionPromises.push(updateNote(note._id, { $pull: { piles: pileId } }))
  })

  works.map((work) => {
    deletionPromises.push(removePileFromWork(String(work._id), pileId))
  })

  await Promise.all(deletionPromises)
  await Pile.findOneAndDelete({ _id: pileId })
}

export const findOrCreatePile = async (name: string) => {
  if (!name) return
  const pile = await Pile.findOneAndUpdate({ name: name }, {}, { upsert: true, new: true })
  generateNick('pile', pile._id).catch(() => {})
  return pile
}

export const findPiles = async function (
  searchObject: Record<string, unknown>,
  sortObject: Record<string, 1 | -1>,
  skip = 0,
  limit = 100
) {
  return await Pile.find(searchObject)
    .sort(sortObject)
    .skip(skip)
    .limit(limit)
    .lean()
    .exec()
}

export const getWorksForPile = async function (pileId: string) {
  return Work.find({ piles: pileId })
    .populate('author')
    .populate('piles')
    .lean()
    .exec()
}

export default defaultControllers(Pile)
