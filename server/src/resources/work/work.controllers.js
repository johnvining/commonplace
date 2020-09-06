import Work from '../work/work.model.js'
import Note from '../note/note.model.js'
import { createAuthor } from '../auth/auth.controllers.js'

// Request response
export const getNotesFromWork = async (req, res) => {
  try {
    const doc = await Note.find({ work: req.params.id })
      .populate('author')
      .populate('ideas')
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

export const getAutoComplete = async (req, res) => {
  try {
    const doc = await findWorksByString(req.body.string)
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

// Direct database
export const createWork = async function(name) {
  return await Work.create({ name: name })
}

export const findWorksByString = async function(str) {
  return await Work.find({ name: new RegExp(str, 'i') }).exec()
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
