// The nick lifecycle, in one place (#367). Every write to a nick row and
// every lookup goes through this module.
//
// A nick row is in one of these states:
//
//   unminted  no row yet for the entity
//   active    the row points at its entity (note, work, idea or pile)
//   alias     the entity was merged into another; the row points there
//             (mergedInto) so old links keep working (#366)
//   retired   the entity is gone; the row keeps its key, so the key is
//             never reissued (#348), and the name it pointed to (#366)
//
// and moves between them only by the transitions in TRANSITIONS. Retiring
// or re-pointing an entity also carries along the aliases that lead to it.
import mongoose, { type Schema } from 'mongoose'
import Nick, { type NickDoc } from './nick.model.js'

export type NickEntityType = 'note' | 'work' | 'idea' | 'pile'
export type NickState = 'unminted' | 'active' | 'alias' | 'retired'
export type NickTransition = 'mint' | 'retire' | 'repoint'

const ENTITY_TYPES: NickEntityType[] = ['note', 'work', 'idea', 'pile']
const PREFIX: Record<NickEntityType, string> = { note: 'n', work: 'w', idea: 'i', pile: 'p' }
const TYPE_BY_PREFIX: Record<string, NickEntityType> = { n: 'note', w: 'work', i: 'idea', p: 'pile' }

// From each state, where each transition leads. A missing entry is an
// illegal move. Minting an active nick returns it unchanged; retiring or
// re-pointing an entity that never had a nick does nothing.
export const TRANSITIONS: Record<NickTransition, Partial<Record<NickState, NickState>>> = {
  mint: { unminted: 'active', active: 'active' },
  retire: { unminted: 'unminted', active: 'retired', alias: 'retired' },
  repoint: { unminted: 'unminted', active: 'alias', alias: 'alias' },
}

export function nextState(state: NickState, transition: NickTransition): NickState {
  const to = TRANSITIONS[transition][state]
  if (!to) throw new Error(`Cannot ${transition} a nick that is ${state}`)
  return to
}

// The one place a row's state is read. An entity ref wins over any stale
// flags, so a row can't be both live and retired.
export function stateOf(row: Partial<NickDoc> | null | undefined): NickState {
  if (!row) return 'unminted'
  if (ENTITY_TYPES.some((t) => row[t])) return 'active'
  if (row.mergedInto) return 'alias'
  return 'retired'
}

export const nickTypeOf = (key: string | null | undefined): NickEntityType | undefined =>
  TYPE_BY_PREFIX[(key ?? '').charAt(0)]

// ---- mint -------------------------------------------------------------------

async function randomKey(prefix: string): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const key = prefix + ('000000' + Math.floor(Math.random() * 1000000)).slice(-6)
    if (!(await Nick.exists({ key }))) return key
  }
  throw new Error(`No free nick key for prefix "${prefix}" after 100 tries`)
}

export const hashFunc = function hash(str: string): number {
  let hash = 0
  for (let i = 0, len = str.length; i < len; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

// unminted → active. Returns the entity's nick row, making one if needed.
// Keys come from a hash chain of the id, then random; every row, retired
// ones included, counts as taken, so no key is ever reissued.
export async function mintNick(type: NickEntityType, id: unknown) {
  const prefix = PREFIX[type]
  if (!prefix) return null
  const existing = await Nick.findOne({ [type]: id })
  if (nextState(stateOf(existing), 'mint') === 'active' && existing) return existing
  // Never for a record that doesn't exist: the page of a deleted one asks
  // for its nick too, and would leave a nick for a dead id (#384)
  if (!(await entityExists(type, id))) return null

  let key: string | undefined
  let hash = hashFunc(String(id))
  for (let i = 0; i < 100; i++) {
    const candidate = prefix + ('000000' + Math.abs(hash)).slice(-6)
    if (!(await Nick.exists({ key: candidate }))) { key = candidate; break }
    hash = hashFunc(String(hash))
  }
  if (!key) key = await randomKey(prefix)

  // A duplicate key error is either a race on this entity (another caller
  // minted it: return theirs) or on the key with another entity (try a
  // random key) (#347).
  for (let attempt = 0; ; attempt++) {
    try {
      return await Nick.create({ key, [type]: id })
    } catch (e: any) {
      if (e?.code !== 11000) throw e
      const winner = await Nick.findOne({ [type]: id })
      if (winner || attempt >= 4) return winner
      key = await randomKey(prefix)
    }
  }
}

// Mint a nick whenever a new entity is saved, before the save returns, so
// no creation path can leave one nickless. A failure is logged, never
// thrown: the entity is already saved, and a backfill can mint it later.
// Upserts and raw inserts skip save hooks; those paths call mintNick
// themselves (findOrCreatePile).
export function mintNickOnCreate(schema: Schema, type: NickEntityType) {
  schema.pre('save', function () {
    this.$locals.mintNick = this.isNew
  })
  schema.post('save', async function (doc: any) {
    if (!doc.$locals?.mintNick) return
    doc.$locals.mintNick = false
    try {
      await mintNick(type, doc._id)
    } catch (e) {
      console.error(`Could not mint a nick for ${type} ${doc._id}`, e)
    }
  })
}

// ---- retire and re-point ----------------------------------------------------

// The name a retired nick keeps: a note's title, or the start of its text.
// Best effort: a failed lookup must never stop the delete that called it.
async function snapshotName(type: NickEntityType, id: unknown): Promise<string | undefined> {
  try {
    const doc: any = await mongoose.model(type).findById(id, { name: 1, title: 1, text: 1 }).lean().exec()
    const name = String(doc?.name || doc?.title || doc?.text || '').trim()
    return name ? name.slice(0, 120) : undefined
  } catch (e) {
    console.error(`Could not keep the name of ${type} ${id} for its nick`, e)
    return undefined
  }
}

// active → retired, for an entity about to be deleted. Call it before the
// delete, so the name is still there to keep. Aliases leading to the
// entity retire with it (alias → retired), keeping their own names.
export async function retireNick(type: NickEntityType, id: unknown) {
  const row = await Nick.findOne({ [type]: id }).lean().exec()
  if (nextState(stateOf(row), 'retire') === 'retired' && row) {
    const name = await snapshotName(type, id)
    await Nick.updateOne(
      { _id: row._id },
      { $unset: { [type]: 1, mergedInto: 1 }, $set: { retired: true, retiredAt: new Date(), formerId: id, ...(name ? { name } : {}) } }
    ).exec()
  }
  await Nick.updateMany({ mergedInto: id }, { $unset: { mergedInto: 1 }, $set: { retired: true } }).exec()
}

// active → alias, for an entity being merged into `into` of the same
// type. Its nick, and any aliases leading to it, then resolve to `into`
// (alias → alias). `into` keeps its own nick.
export async function repointNick(type: NickEntityType, id: unknown, into: unknown) {
  if (String(id) === String(into)) throw new Error('Cannot re-point a nick to its own entity')
  const row = await Nick.findOne({ [type]: id }).lean().exec()
  if (nextState(stateOf(row), 'repoint') === 'alias' && row) {
    const name = await snapshotName(type, id)
    await Nick.updateOne(
      { _id: row._id },
      { $unset: { [type]: 1 }, $set: { mergedInto: into, retired: true, retiredAt: new Date(), formerId: id, ...(name ? { name } : {}) } }
    ).exec()
  }
  await Nick.updateMany({ mergedInto: id }, { $set: { mergedInto: into } }).exec()
}

// ---- resolve ------------------------------------------------------------------

export type NickResolution =
  | { state: 'active'; key: string; type: NickEntityType; id: string }
  | { state: 'alias'; key: string; type: NickEntityType; id: string; mergedFrom: string | null }
  | { state: 'retired'; key: string; type: NickEntityType | null; name: string | null; retiredAt: Date | null }

async function entityExists(type: NickEntityType, id: unknown) {
  try {
    return Boolean(await mongoose.model(type).exists({ _id: id }))
  } catch {
    return false
  }
}

// What a key leads to, or null for a key never minted. Every lookup uses
// this. A nick whose entity no longer exists (deleted some way that
// skipped retireNick) resolves as retired rather than to a dead id.
export async function resolveNick(key: string): Promise<NickResolution | null> {
  if (typeof key !== 'string' || !key) return null
  const row = await Nick.findOne({ key }).lean().exec()
  if (!row) return null
  const state = stateOf(row)
  const type = nickTypeOf(row.key) ?? ENTITY_TYPES.find((t) => row[t]) ?? null
  const retired = { state: 'retired' as const, key: row.key!, type, name: row.name ?? null, retiredAt: row.retiredAt ?? null }
  if (!type || state === 'retired') return retired

  const id = state === 'active' ? row[type] : row.mergedInto
  if (!(await entityExists(type, id))) return retired
  return state === 'active'
    ? { state: 'active', key: row.key!, type, id: String(id) }
    : { state: 'alias', key: row.key!, type, id: String(id), mergedFrom: row.name ?? null }
}

// What became of an entity that no longer exists, by its old id: the
// resolution of the nick it had, so a merged work leads to the kept one and
// a deleted record keeps its name (#384). Null when nothing is known, e.g.
// it was deleted before formerId was recorded.
export async function resolveFormer(type: NickEntityType, id: string): Promise<NickResolution | null> {
  if (!PREFIX[type] || !mongoose.isValidObjectId(id)) return null
  const row = await Nick.findOne({ formerId: id, key: new RegExp('^' + PREFIX[type]) }, { key: 1 }).lean().exec()
  return row?.key ? resolveNick(row.key) : null
}

// ---- reads by entity ------------------------------------------------------------

// The live nick row of one entity, or null
export const nickFor = (type: NickEntityType, id: unknown) =>
  Nick.findOne({ [type]: id }).lean().exec()

// entity id → nick key, for a list of entities
export async function nickKeysFor(type: NickEntityType, ids: unknown[]): Promise<Map<string, string>> {
  const rows = await Nick.find({ [type]: { $in: ids } }, { key: 1, [type]: 1 }).lean().exec()
  return new Map(rows.filter((r: any) => r.key && r[type]).map((r: any) => [String(r[type]), r.key]))
}

// Ids of the entities of a type that have a live nick
export async function entitiesWithNicks(type: NickEntityType): Promise<Set<string>> {
  const rows = await Nick.find({ [type]: { $exists: true } }, { [type]: 1 }).lean().exec()
  return new Set(rows.map((r: any) => String(r[type])))
}
