import Work from '../work/work.model.js'
import Note from '../note/note.model.js'

// Request response
export const getNotesFromWork = async (req, res) => {
  try {
    const doc = await Note.find({ work: req.params.id })
      .populate('author')
      .populate('ideas')
      .populate('work')
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

// Direct database
export const createWork = async function(name) {
  return await Work.create({ name: name })
}

export const findWorksByString = async function(str) {
  return await Work.find({ name: new RegExp(str, 'i') }).exec()
}

export const getWorkInfo = async function(ideaId) {
  return await Work.findOne({ _id: ideaId }).exec()
}
