import Work from '../work/work.model.js'
import Note from '../note/note.model.js'
import Pile from '../pile/pile.model.js'
import { createAuthor } from '../auth/auth.controllers.js'
import { findNotesAndPopulate } from '../note/note.controllers.js'
import { defaultControllers } from '../../utils/default.controllers.js'

// Request response
export const reqGetNotesForWork = async (req, res) => {
  const doc = await findNotesAndPopulate({ work: req.params.id }, {})
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqGetWorkInfo = async (req, res) => {
  const doc = await getWorkInfo(req.params.id)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqCreateWork = async (req, res) => {
  const doc = await createWork(req.body.name)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqUpdateWork = async (req, res) => {
  const doc = await updateWorkInfo(req.params.id, req.body)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqCreateAndAddAuth = async (req, res) => {
  const newAuth = await createAuthor(req.body.author)
  const updateObject = { author: newAuth.id }
  const doc = await updateWorkInfo(req.params.id, updateObject)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqDeleteWork = async (req, res) => {
  await deleteWork(req.params.id)
}

export const reqAddPile = async (req, res) => {
  const doc = await addPileToId(req.params.id, req.body.id)
  return doc
}

export const reqAddNewPile = async (req, res) => {
  const newPile = await Pile.create({ name: req.body.name })
  const doc = await addPileToId(req.params.id, newPile._id)
  return doc
}

export const reqGetAutoCompleteWithCounts = async (req, res) => {
  return await reqAutocompleteOnName(req, res, true)
}

export const reqAutocompleteOnName = async (req, res, withCounts = false) => {
  const doc = await findWorksByString(req.body.string, withCounts)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const reqRemovePileFromWork = async (req, res) => {
  const doc = await removePileFromWork(req.params.id, req.params.pileId)
  if (!doc) {
    return res.status(400).end()
  }
  return doc
}

export const findWorksByString = async function(string, withCounts = false) {
  let works = await Work.find({ name: new RegExp(string, 'i') })
    .populate('author')
    .lean()
    .exec()
  if (!withCounts) {
    return works
  } else {
    let notePromises = []
    works.map(work => {
      notePromises.push(Note.find({ work: work._id }).countDocuments())
    })

    await Promise.all(notePromises).then(result => {
      result.map((val, idx) => {
        works[idx] = { ...works[idx], note_count: val }
      })
    })

    return works
  }
}

export const createWork = async function(name) {
  return await Work.create({ name: name })
}

export const getWorkInfo = async function(workId) {
  const results = await Work.findOne({ _id: workId })
    .populate('author')
    .populate('piles')
    .lean()
    .exec()
  return results
}

export const updateWorkInfo = async function(workId, updateObject) {
  return await Work.findOneAndUpdate({ _id: workId }, updateObject)
}

export const findWorkByString = async function(name) {
  return await Work.findOne({ name: name }).exec()
}

export const findOrCreateWork = async function(name) {
  if (name == '') return null
  // TODO: Can this be done with a single mongo call?
  const work = await findWorkByString(name)
  if (work?._id != null) {
    return work
  }

  return await createWork(name)
}

export const deleteWork = async function(id) {
  let notes = await findNotesAndPopulate({ work: id }, {}, true)
  let deletionPromises = []
  notes.map(note => {
    deletionPromises.push(updateNote(note._id), { work: null })
  })

  await Promise.all(deletionPromises)
  await Work.findOneAndDelete({ _id: id })
}

export const addPileToId = async (workId, pileId) => {
  return await Work.findOneAndUpdate(
    { _id: workId },
    { $addToSet: { piles: pileId } },
    { new: true }
  )
    .populate('piles')
    .lean()
    .exec()
}

export const removePileFromWork = async (workId, pileId) => {
  return Work.findOneAndUpdate(
    { _id: workId },
    { $pull: { piles: pileId } },
    { new: true }
  )
    .lean()
    .exec()
}

export default defaultControllers(Work)
