import Nick from '../nick/nick.model.js'
import Work from '../work/work.model.js'
import Note from '../note/note.model.js'
import Pile from '../pile/pile.model.js'
import { defaultControllers } from '../../utils/default.controllers.js'

export const reqGenerateNickForNote = async (req, res) => {
  let existingNick = await Nick.findOne({ note: req.params.id })

  if (!existingNick || existingNick._id == null) {
    var hash = hashFunc(req.params.id)

    while (true) {
      let hashString = ('000000' + hash).slice(-6)
      let dupe = await Nick.findOne({ key: 'n' + hashString })
      if (!dupe) {
        return await Nick.create({ key: 'n' + hashString, note: req.params.id })
      } else {
        hash = hashFunc(hash)
      }
    }
  } else {
    return existingNick
  }
}

export const reqGetNick = async (req, res) => {
  const nick = await Nick.findOne({ key: req.params.nick })
  return nick
}

export const hashFunc = function hash(str) {
  let hash = 0
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

export default defaultControllers(Work)
