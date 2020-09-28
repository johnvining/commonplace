import Work from '../work/work.model.js'
import Note from '../note/note.model.js'
import Pile from '../pile/pile.model.js'
import { createAuthor } from '../auth/auth.controllers.js'
import { removeWorkFromNote } from '../note/note.controllers.js'
import { crudControllers } from '../../utils/crud.js'

// Request response
export const reqGetNotesForWork = async (req, res) => {
  try {
    const doc = await getNotesFromWork(req.params.id)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetWorkInfo = async (req, res) => {
  try {
    const doc = await getWorkInfo(req.params.id)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqCreateWork = async (req, res) => {
  try {
    const doc = await createWork(req.body.name)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqUpdateWork = async (req, res) => {
  try {
    const doc = await updateWorkInfo(req.params.id, req.body)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqCreateAndAddAuth = async (req, res) => {
  try {
    const newAuth = await createAuthor(req.body.author)
    const updateObject = { author: newAuth.id }
    const doc = await updateWorkInfo(req.params.id, updateObject)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqDeleteWork = async (req, res) => {
  try {
    await deleteWork(req.params.id)
    res.status(200).json()
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqAddPile = async (req, res) => {
  try {
    const docs = await addPileToID(req.params.id, req.body.id)
    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqAddNewPile = async (req, res) => {
  try {
    const newPile = await Pile.create({ name: req.body.name })
    const docs = await addPileToID(req.params.id, newPile._id)
    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

export const reqGetAutoCompleteWithCounts = async (req, res) => {
  return await reqAutocompleteOnName(req, res, true)
}

export const reqAutocompleteOnName = async (req, res, withCounts = false) => {
  try {
    const doc = await findWorksByString(req.body.string, withCounts)
    if (!doc) {
      return res.status(400).end()
    }
    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
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
    .lean()
    .exec()
  return results
}

export const updateWorkInfo = async function(workID, updateObject) {
  return await Work.findOneAndUpdate({ _id: workID }, updateObject)
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

export const getNotesFromWork = async function(workID, slim = false) {
  if (slim) {
    return Note.find({ work: workID })
      .lean()
      .exec()
  } else {
    return Note.find({ work: workID })
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
  }
}

export const deleteWork = async function(id) {
  let notes = await getNotesFromWork(id, true)
  let deletionPromises = []
  notes.map(note => {
    deletionPromises.push(removeWorkFromNote(note._id))
  })

  await Promise.all(deletionPromises)
  await Work.findOneAndDelete({ _id: id })
}

export const addPileToID = async (workId, pileID) => {
  return await Work.findOneAndUpdate(
    { _id: workId },
    { $addToSet: { piles: pileID } },
    { new: true }
  )
    .populate('piles')
    .lean()
    .exec()
}

export default crudControllers(Work)
