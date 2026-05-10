import Nick from '../nick/nick.model.js'

const PREFIX = { note: 'n', work: 'w', idea: 'i', pile: 'p' }

async function generateRandomNickKey(prefix) {
  for (let i = 0; i < 100; i++) {
    const key = prefix + ('000000' + Math.floor(Math.random() * 1000000)).slice(-6)
    if (!await Nick.findOne({ key })) return key
  }
  throw new Error(`generateRandomNickKey exhausted 100 attempts for prefix "${prefix}"`)
}

export const generateNick = async (type, id) => {
  const prefix = PREFIX[type]
  if (!prefix) return null

  const existing = await Nick.findOne({ [type]: id })
  if (existing?._id) return existing

  // find an unused key via hash chain, fall back to random
  let key
  let hash = hashFunc(String(id))
  for (let i = 0; i < 100; i++) {
    const candidate = prefix + ('000000' + Math.abs(hash)).slice(-6)
    if (!await Nick.findOne({ key: candidate })) { key = candidate; break }
    hash = hashFunc(String(hash))
  }
  if (!key) key = await generateRandomNickKey(prefix)

  try {
    return await Nick.create({ key, [type]: id })
  } catch (e: any) {
    if (e?.code === 11000) return Nick.findOne({ [type]: id })
    throw e
  }
}

export const reqGenerateNickForNote = async (req, res) => generateNick('note', req.params.id)
export const reqGenerateNickForWork = async (req, res) => generateNick('work', req.params.id)
export const reqGenerateNickForIdea = async (req, res) => generateNick('idea', req.params.id)
export const reqGenerateNickForPile = async (req, res) => generateNick('pile', req.params.id)

export const reqGetNick = async (req, res) => {
  return Nick.findOne({ key: req.params.nick })
}

export const reqBackfillNicks = async (req, res) => {
  const { default: Note } = await import('../note/note.model.js')
  const { default: Work } = await import('../work/work.model.js')
  const { default: Idea } = await import('../idea/idea.model.js')
  const { default: Pile } = await import('../pile/pile.model.js')

  const types = [
    { type: 'note', Model: Note },
    { type: 'work', Model: Work },
    { type: 'idea', Model: Idea },
    { type: 'pile', Model: Pile },
  ]

  const results: Record<string, any> = {}
  for (const { type, Model } of types) {
    const all = await (Model as any).find({}, { _id: 1 }).lean().exec()
    const existing = await Nick.find({ [type]: { $exists: true } }, { [type]: 1 }).lean().exec()
    const covered = new Set(existing.map((n: any) => String(n[type])))
    const missing = all.filter((doc: any) => !covered.has(String(doc._id)))

    let created = 0, failed = 0
    for (const doc of missing) {
      try { await generateNick(type, (doc as any)._id); created++ }
      catch { failed++ }
    }
    results[type] = { total: all.length, already_had_nick: all.length - missing.length, created, failed }
  }
  return results
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
