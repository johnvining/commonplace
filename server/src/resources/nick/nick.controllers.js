import Nick from '../nick/nick.model.js'

const PREFIX = { note: 'n', work: 'w', idea: 'i', pile: 'p' }

export const generateNick = async (type, id) => {
  const prefix = PREFIX[type]
  if (!prefix) return null

  const existing = await Nick.findOne({ [type]: id })
  if (existing?._id) return existing

  // 100 hash-chain attempts
  let hash = hashFunc(String(id))
  for (let i = 0; i < 100; i++) {
    const key = prefix + ('000000' + Math.abs(hash)).slice(-6)
    if (!await Nick.findOne({ key })) {
      return Nick.create({ key, [type]: id })
    }
    hash = hashFunc(String(hash))
  }

  // 100 random fallback attempts
  for (let i = 0; i < 100; i++) {
    const key = prefix + ('000000' + Math.floor(Math.random() * 1000000)).slice(-6)
    if (!await Nick.findOne({ key })) {
      return Nick.create({ key, [type]: id })
    }
  }

  throw new Error(`Nick generation failed for ${type} ${id} after 200 attempts`)
}

export const reqGenerateNickForNote = async (req, res) => generateNick('note', req.params.id)
export const reqGenerateNickForWork = async (req, res) => generateNick('work', req.params.id)
export const reqGenerateNickForIdea = async (req, res) => generateNick('idea', req.params.id)
export const reqGenerateNickForPile = async (req, res) => generateNick('pile', req.params.id)

export const reqGetNick = async (req, res) => {
  return Nick.findOne({ key: req.params.nick })
}

export const reqGetNickForNote = async (req, res) => Nick.findOne({ note: req.params.id }).lean().exec()
export const reqGetNickForWork = async (req, res) => Nick.findOne({ work: req.params.id }).lean().exec()
export const reqGetNickForIdea = async (req, res) => Nick.findOne({ idea: req.params.id }).lean().exec()
export const reqGetNickForPile = async (req, res) => Nick.findOne({ pile: req.params.id }).lean().exec()

export const hashFunc = function hash(str) {
  let hash = 0
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return hash
}
