import Nick from '../nick/nick.model.js'

export const reqGenerateNickForNote = async (req, res) => {
  return generateNickForType(req, res, 'note')
}
export const reqGenerateNickForWork = async (req, res) => {
  return generateNickForType(req, res, 'work')
}
export const reqGenerateNickForIdea = async (req, res) => {
  return generateNickForType(req, res, 'idea')
}
export const reqGenerateNickForPile = async (req, res) => {
  return generateNickForType(req, res, 'pile')
}

export const generateNickForType = async (req, res, type) => {
  console.log('get nick for type: ' + type)

  if (type == 'note') {
    var existingNick = await Nick.findOne({ note: req.params.id })
    var prefix = 'n'
  } else if (type == 'work') {
    var existingNick = await Nick.findOne({ work: req.params.id })
    var prefix = 'w'
  } else if (type == 'idea') {
    var existingNick = await Nick.findOne({ idea: req.params.id })
    var prefix = 'i'
  } else if (type == 'pile') {
    var existingNick = await Nick.findOne({ pile: req.params.id })
    var prefix = 'p'
  } else {
    return null
  }

  console.log('existing nick: ' + existingNick)
  console.log('prefix: ' + prefix)

  if (!existingNick || existingNick._id == null) {
    var hash = hashFunc(req.params.id)

    console.log('dupe: ' + dupe)
    console.log('id: ' + req.params.id)
    console.log('hash: ' + hash)

    while (true) {
      let hashString = ('000000' + hash).slice(-6)
      let dupe = await Nick.findOne({ key: prefix + hashString })

      if (!dupe) {
        if (type == 'note') {
          return await Nick.create({
            key: prefix + hashString,
            note: req.params.id,
          })
        } else if (type == 'work') {
          return await Nick.create({
            key: prefix + hashString,
            work: req.params.id,
          })
        } else if (type == 'idea') {
          return await Nick.create({
            key: prefix + hashString,
            idea: req.params.id,
          })
        } else if (type == 'pile') {
          return await Nick.create({
            key: prefix + hashString,
            pile: req.params.id,
          })
        }
      } else {
        // If there's a duplicate, hash again and check on the next round
        // console.log(
        //   'Duplicate nick found for hash: ' +
        //     hash +
        //     ' and hashstring: ' +
        //     hashString
        // )
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
