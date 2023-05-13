import Nick from '../nick/nick.model.js'
import Work from '../work/work.model.js'
import Note from '../note/note.model.js'
import Pile from '../pile/pile.model.js'
import { defaultControllers } from '../../utils/default.controllers.js'

export const reqGenerateNickForNote = async (req, res) => {
  let existingNick = await Nick.findOne({ note: req.params.id })
  console.log(existingNick)

  if (!existingNick || existingNick._id == null) {
    let hash = hash(req.params.id)

    // TODO: Check for duplicate
    return await Nick.create({ key: 'n' + key, note: req.params.id })
  } else {
    return existingNick
  }
}

export const findNick = async function(nick) {
  return await Nick.findOne({ key: nick })
}

export const hash = function hash(str) {
  let hash = 0
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  let hashString = hash.toString().substring(0, 6)
  return hashString
}

export default defaultControllers(Work)
