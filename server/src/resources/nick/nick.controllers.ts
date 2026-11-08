import type { Request, Response } from 'express'
import {
  mintNick,
  nickFor,
  entitiesWithNicks,
  resolveNick,
  resolveFormer,
  NICK_TYPES,
  type NickEntityType,
  type NickResolution,
} from './nickLifecycle.js'

// The lifecycle itself lives in nickLifecycle.ts (#367); these are its
// HTTP handlers.

export const reqGenerateNickForNote = async (req: Request, res: Response) => mintNick('note', req.params.id)
export const reqGenerateNickForWork = async (req: Request, res: Response) => mintNick('work', req.params.id)
export const reqGenerateNickForIdea = async (req: Request, res: Response) => mintNick('idea', req.params.id)
export const reqGenerateNickForPile = async (req: Request, res: Response) => mintNick('pile', req.params.id)
export const reqGenerateNickForAuth = async (req: Request, res: Response) => mintNick('auth', req.params.id)

// GET /nick/:key. Every answer carries `state`:
//   active   { key, state, <type>: id }
//   alias    { key, state, <type>: id of the work it was merged into, mergedFrom }
//   retired  { key, state, retired: true, name, retiredAt }, with no entity id
// and a key never minted gives null.
export const reqGetNick = async (req: Request, res: Response) => answerFor(await resolveNick(String(req.params.nick)))

// GET /nick/former/:type/:id: what became of an entity that no longer
// exists, by its old id, in the same shape as GET /nick/:key; null when
// nothing is known (#384)
export const reqGetFormer = async (req: Request, res: Response) => {
  const type = String(req.params.type) as NickEntityType
  if (!NICK_TYPES.includes(type)) return res.status(400).json({ message: 'Unknown type' })
  return answerFor(await resolveFormer(type, String(req.params.id)))
}

function answerFor(found: NickResolution | null) {
  if (!found) return null
  if (found.state === 'retired') {
    return { key: found.key, state: found.state, retired: true, name: found.name, retiredAt: found.retiredAt }
  }
  return {
    key: found.key,
    state: found.state,
    [found.type]: found.id,
    ...(found.state === 'alias' ? { mergedFrom: found.mergedFrom } : {}),
  }
}

export const reqBackfillNicks = async (req: Request, res: Response) => {
  const { default: Note } = await import('../note/note.model.js')
  const { default: Work } = await import('../work/work.model.js')
  const { default: Idea } = await import('../idea/idea.model.js')
  const { default: Pile } = await import('../pile/pile.model.js')
  const { Auth } = await import('../auth/auth.model.js')

  const types: { type: NickEntityType; Model: any }[] = [
    { type: 'note', Model: Note },
    { type: 'work', Model: Work },
    { type: 'idea', Model: Idea },
    { type: 'pile', Model: Pile },
    { type: 'auth', Model: Auth },
  ]

  const results: Record<string, any> = {}
  for (const { type, Model } of types) {
    const all = await (Model as any).find({}, { _id: 1 }).lean().exec()
    const covered = await entitiesWithNicks(type)
    const missing = all.filter((doc: any) => !covered.has(String(doc._id)))

    let created = 0, failed = 0
    for (const doc of missing) {
      try { await mintNick(type, (doc as any)._id); created++ }
      catch { failed++ }
    }
    results[type] = { total: all.length, already_had_nick: all.length - missing.length, created, failed }
  }
  return results
}

export const reqGetNickForNote = async (req: Request, res: Response) => nickFor('note', req.params.id)
export const reqGetNickForWork = async (req: Request, res: Response) => nickFor('work', req.params.id)
export const reqGetNickForIdea = async (req: Request, res: Response) => nickFor('idea', req.params.id)
export const reqGetNickForPile = async (req: Request, res: Response) => nickFor('pile', req.params.id)
export const reqGetNickForAuth = async (req: Request, res: Response) => nickFor('auth', req.params.id)
