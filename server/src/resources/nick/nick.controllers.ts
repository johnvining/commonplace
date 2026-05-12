import Nick from '../nick/nick.model.js'
import type { Request, Response } from 'express'


type NickEntityType = 'note' | 'work' | 'idea' | 'pile'

const PREFIX: Record<NickEntityType, string> = { note: 'n', work: 'w', idea: 'i', pile: 'p' }

async function generateRandomNickKey(prefix: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const key = prefix + ('000000' + Math.floor(Math.random() * 1000000)).slice(-6)
    if (!await Nick.findOne({ key })) return key
  }
  throw new Error(`generateRandomNickKey exhausted 100 attempts for prefix "${prefix}"`)
}

export const generateNick = async (type: NickEntityType, id: unknown) => {
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

// Drop the nick row for an entity that's about to be deleted. Keeps the
// global key -> entity index clean so a stale lookup can't resolve to a
// deleted parent.
export const deleteNickFor = async (type: NickEntityType, id: unknown) => {
  await Nick.deleteOne({ [type]: id }).exec()
}

export const reqGenerateNickForNote = async (req: Request, res: Response) => generateNick('note', req.params.id)
export const reqGenerateNickForWork = async (req: Request, res: Response) => generateNick('work', req.params.id)
export const reqGenerateNickForIdea = async (req: Request, res: Response) => generateNick('idea', req.params.id)
export const reqGenerateNickForPile = async (req: Request, res: Response) => generateNick('pile', req.params.id)

export const reqGetNick = async (req: Request, res: Response) => {
  return Nick.findOne({ key: req.params.nick })
}

export const reqBackfillNicks = async (req: Request, res: Response) => {
  const { default: Note } = await import('../note/note.model.js')
  const { default: Work } = await import('../work/work.model.js')
  const { default: Idea } = await import('../idea/idea.model.js')
  const { default: Pile } = await import('../pile/pile.model.js')

  const types: { type: NickEntityType; Model: any }[] = [
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

export const reqGetNickForNote = async (req: Request, res: Response) => Nick.findOne({ note: req.params.id }).lean().exec()
export const reqGetNickForWork = async (req: Request, res: Response) => Nick.findOne({ work: req.params.id }).lean().exec()
export const reqGetNickForIdea = async (req: Request, res: Response) => Nick.findOne({ idea: req.params.id }).lean().exec()
export const reqGetNickForPile = async (req: Request, res: Response) => Nick.findOne({ pile: req.params.id }).lean().exec()

export const hashFunc = function hash(str: string): number {
  let hash = 0
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return hash
}
