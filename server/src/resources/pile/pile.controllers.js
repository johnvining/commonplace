import Pile from './pile.model.js'
import Note from '../note/note.model.js'
import Work from '../work/work.model.js'
import { crudControllers } from '../../utils/crud.js'

export const reqGetNotesForPile = async (req, res) => {
  try {
    const doc = await Note.find({ piles: req.params.id })
      .sort({ updatedAt: -1 })
      .populate('author')
      .populate('ideas')
      .populate('piles')
      .populate({
        path: 'work',
        populate: {
          path: 'author'
        }
      })
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

export const reqGetWorksForPile = async (req, res) => {
  try {
    const doc = await Work.find({ piles: req.params.id }).populate('author')
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetAutoCompleteWithCounts = async (req, res) => {
  return reqGetAutoComplete(req, res, true)
}

export const reqGetAutoComplete = async (req, res, withCounts = false) => {
  try {
    const doc = await filePilesByString(req.body.string, withCounts)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
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

export const reqCreatePile = async (req, res) => {
  try {
    const doc = await findOrCreatePile(req.body.name)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const findOrCreatePile = async name => {
  return Pile.findOneAndUpdate({ name: name }, {}, { upsert: true, new: true })
}

export default crudControllers(Pile)
