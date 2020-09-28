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

export const findOrCreatePile = async name => {
  return Pile.findOneAndUpdate({ name: name }, {}, { upsert: true, new: true })
}

export default crudControllers(Pile)
