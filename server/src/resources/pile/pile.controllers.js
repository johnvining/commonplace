import Pile from './pile.model.js'
import Note from '../note/note.model.js'
import Work from '../work/work.model.js'
import { updateNote, findNotesAndPopulate } from '../note/note.controllers.js'
import { defaultControllers } from '../../utils/default.controllers.js'
import { removePileFromWork } from '../work/work.controllers.js'

export const reqGetNotesForPile = async (req, res) => {
  const doc = await findNotesAndPopulate(
    { piles: req.params.id },
    { updatedAt: -1 }
  )
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetWorksForPile = async (req, res) => {
  const doc = await getWorksForPile(req.params.id)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetAutoCompleteWithCounts = async (req, res) => {
  return reqGetAutoComplete(req, res, true)
}

export const reqGetAutoComplete = async (req, res, withCounts = false) => {
  const doc = await filePilesByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqCreatePile = async (req, res) => {
  const doc = await findOrCreatePile(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeletePile = async (req, res) => {
  await deletePile(req.params.id)
}

// TODO: Duplicative of whats in work.controllers.js
export const filePilesByString = async function(string, withCounts) {
  let piles = await Pile.find({ name: new RegExp(string, 'i') })
    .lean()
    .exec()
  if (!withCounts) {
    return piles
  } else {
    let notePromises = [],
      workPromises = []
    piles.map(pile => {
      notePromises.push(Note.find({ piles: pile._id }).countDocuments())
      workPromises.push(Work.find({ piles: pile._id }).countDocuments())
    })

    let noteFiler = Promise.all(notePromises).then(result => {
      result.map((val, idx) => {
        piles[idx] = { ...piles[idx], note_count: val }
      })
    })
    let workFiler = Promise.all(workPromises).then(result => {
      result.map((val, idx) => {
        piles[idx] = { ...piles[idx], work_count: val }
      })
    })

    await Promise.all([noteFiler, workFiler])
    return piles
  }
}

export const deletePile = async function(pileId) {
  // TODO: Parallel
  let notes = await findNotesAndPopulate(
    { piles: pileId },
    { updatedAt: -1 },
    true
  )
  let works = await getWorksForPile(pileId)
  let deletionPromises = []
  notes.map(note => {
    deletionPromises.push(updateNote(note._id, { $pull: { piles: pileId } }))
  })

  works.map(work => {
    deletionPromises.push(removePileFromWork(work._id, pileId))
  })

  await Promise.all(deletionPromises)
  await Pile.findOneAndDelete({ _id: pileId })
}

export const findOrCreatePile = async name => {
  if (!name) return
  return Pile.findOneAndUpdate({ name: name }, {}, { upsert: true, new: true })
}

export const getWorksForPile = async function(pileId) {
  return Work.find({ piles: pileId })
    .populate('author')
    .lean()
    .exec()
}

export default defaultControllers(Pile)
