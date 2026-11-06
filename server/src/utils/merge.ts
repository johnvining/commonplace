// Merging duplicate works and authors (#360), and splitting a combined
// author into several (#356). Everything goes through Mongoose so
// timestamps bump: changed notes surface on the home feed.
//
// Each operation first works out its plan: what will move. With dryRun
// the plan is returned and nothing is written. Every plan carries a
// fingerprint of the exact ids it would move (#369); pass it back as
// `expect` when executing, and if the data changed since the preview the
// execute refuses with PlanChangedError, carrying the new plan, instead
// of doing something other than what was approved.
import crypto from 'crypto'
import Work from '../resources/work/work.model.js'
import Note from '../resources/note/note.model.js'
import Pin from '../resources/pin/pin.model.js'
import { Auth } from '../resources/auth/auth.model.js'
import { repointNick } from '../resources/nick/nickLifecycle.js'
import { escapeRegexInput } from './searchInput.js'

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status })
}

export class PlanChangedError extends Error {
  status = 409
  constructor(public plan: unknown) {
    super('This changed since the preview; check the new plan and try again')
  }
}

export interface PlanOptions {
  dryRun?: boolean
  // The fingerprint of the plan that was previewed
  expect?: string
}

// A stable hash of what a plan would do: sorted ids, filled fields
function fingerprintOf(details: Record<string, unknown>): string {
  const canonical = JSON.stringify(details, (_, value) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value
  )
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

// Return the plan for a dry run; refuse an execute whose plan no longer
// matches the previewed one; otherwise let the execute go ahead.
function checkPlan<T extends { fingerprint: string }>(plan: T, { dryRun, expect }: PlanOptions): boolean {
  if (dryRun) return true
  if (expect !== undefined && expect !== plan.fingerprint) throw new PlanChangedError(plan)
  return false
}

const sortedIds = async (Model: any, query: object) =>
  (await Model.find(query, { _id: 1 }).lean().exec()).map((d: any) => String(d._id)).sort()

const ids = (list: unknown[] | undefined) => (list ?? []).map(String)

// Ids in `extra` that `base` lacks, in order
const missingFrom = (base: unknown[] | undefined, extra: unknown[] | undefined) => {
  const have = new Set(ids(base))
  return ids(extra).filter((id) => !have.has(id))
}

// Point the from-entity's star at the kept one, or drop it when the kept
// one is starred already. An unstarred tombstone for the kept one (#381)
// gives way to the moved star.
async function movePin(type: string, from: string, into: string) {
  const pin = await Pin.findOne({ type, target: from, unpinnedAt: null }).exec()
  if (!pin) {
    await Pin.deleteMany({ type, target: from }).exec()
    return false
  }
  if (await Pin.exists({ type, target: into, unpinnedAt: null })) {
    await Pin.deleteOne({ _id: pin._id }).exec()
  } else {
    await Pin.deleteMany({ type, target: into }).exec()
    await Pin.updateOne({ _id: pin._id }, { $set: { target: into, changedAt: new Date() } }).exec()
  }
  return true
}

async function loadPair<T>(find: (id: string) => Promise<T | null>, from: string, into: string, label: string) {
  if (String(from) === String(into)) throw httpError(400, `Cannot merge a ${label} into itself`)
  const [fromDoc, intoDoc] = await Promise.all([find(from), find(into)])
  if (!fromDoc) throw httpError(404, `No ${label} ${from}`)
  if (!intoDoc) throw httpError(404, `No ${label} ${into}`)
  return [fromDoc, intoDoc] as const
}

const WORK_FILL_FIELDS = ['original_name', 'url', 'year', 'citation_information', 'summary'] as const

export async function mergeWorks(from: string, into: string, options: PlanOptions = {}) {
  const [fromWork, intoWork] = await loadPair(
    (id) => Work.findById(id).lean().exec(),
    from,
    into,
    'work'
  )

  const piles = missingFrom(intoWork.piles, fromWork.piles)
  const ideas = missingFrom(intoWork.ideas, fromWork.ideas)
  const authors = missingFrom(intoWork.authors, fromWork.authors)
  const editors = missingFrom(intoWork.editors, fromWork.editors)
  const translators = missingFrom(intoWork.translators, fromWork.translators)
  // Fields the kept work lacks are taken from the merged one
  const fill: Record<string, unknown> = {}
  for (const field of WORK_FILL_FIELDS) {
    const kept = intoWork[field]
    const other = fromWork[field]
    if ((kept === undefined || kept === null || kept === '') && other !== undefined && other !== null && other !== '') {
      fill[field] = other
    }
  }
  const noteIds = await sortedIds(Note, { work: from })
  const plan = {
    from: { _id: from, name: fromWork.name },
    into: { _id: into, name: intoWork.name },
    notes: noteIds.length,
    piles: piles.length,
    ideas: ideas.length,
    authors: authors.length,
    editors: editors.length,
    translators: translators.length,
    fields: Object.keys(fill),
    fingerprint: fingerprintOf({ from, into, noteIds, piles, ideas, authors, editors, translators, fill }),
  }
  if (checkPlan(plan, options)) return plan

  await Note.updateMany({ work: from }, { $set: { work: into } }).exec()
  await Work.updateOne(
    { _id: into },
    {
      $push: {
        piles: { $each: piles },
        ideas: { $each: ideas },
        authors: { $each: authors },
        editors: { $each: editors },
        translators: { $each: translators },
      },
      $set: fill,
    }
  ).exec()
  await movePin('work', from, into)
  // Old links to the merged work land on the kept one (#366)
  await repointNick('work', from, into)
  await Work.deleteOne({ _id: from }).exec()
  return plan
}

// Every array that can hold an author, and the plan count each feeds
const AUTHOR_FIELDS: [any, string, string][] = [
  [Note, 'authors', 'notes'],
  [Note, 'people', 'notesAbout'],
  [Work, 'authors', 'works'],
  [Work, 'editors', 'edited'],
  [Work, 'translators', 'translated'],
]

// The ids of the notes and works that list an author, per field
async function affectedByAuthor(id: string): Promise<Record<string, string[]>> {
  const lists = await Promise.all(AUTHOR_FIELDS.map(([Model, field]) => sortedIds(Model, { [field]: id })))
  return Object.fromEntries(AUTHOR_FIELDS.map(([, , count], i) => [count, lists[i]]))
}

const countsOf = (affected: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(affected).map(([count, list]) => [count, list.length])) as Record<string, number>

// Replace `from` with `into` (one id or several) in each doc's `field`
// array, keeping its place in the order (the first author is the byline)
// and not doubling up.
async function replaceInArrays(Model: any, field: string, from: string, into: string | string[]) {
  const replacement = Array.isArray(into) ? into : [into]
  const docs = await Model.find({ [field]: from }, { [field]: 1 }).lean().exec()
  for (const doc of docs) {
    const next: string[] = []
    for (const id of ids(doc[field])) {
      for (const mapped of id === from ? replacement : [id]) {
        if (!next.includes(mapped)) next.push(mapped)
      }
    }
    await Model.updateOne({ _id: doc._id }, { $set: { [field]: next } }).exec()
  }
  return docs.length
}

// Like mergeWorks, but authors have no nick, so there's no re-point step:
// the merged author's links simply go when it's deleted.
export async function mergeAuthors(from: string, into: string, options: PlanOptions = {}) {
  const [fromAuth, intoAuth] = await loadPair(
    (id) => Auth.findById(id).lean().exec(),
    from,
    into,
    'author'
  )

  const fill: Record<string, unknown> = {}
  if (intoAuth.birth_year == null && fromAuth.birth_year != null) fill.birth_year = fromAuth.birth_year
  if (intoAuth.death_year == null && fromAuth.death_year != null) fill.death_year = fromAuth.death_year
  const usernames = (fromAuth.usernames ?? []).filter((u) => !(intoAuth.usernames ?? []).includes(u))

  const affected = await affectedByAuthor(from)
  const plan = {
    from: { _id: from, name: fromAuth.name },
    into: { _id: into, name: intoAuth.name },
    ...countsOf(affected),
    fields: [...Object.keys(fill), ...(usernames.length ? ['usernames'] : [])],
    fingerprint: fingerprintOf({ from, into, affected, fill, usernames }),
  }
  if (checkPlan(plan, options)) return plan

  for (const [Model, field] of AUTHOR_FIELDS) await replaceInArrays(Model, field, from, into)
  await Auth.updateOne({ _id: into }, { $set: fill, $push: { usernames: { $each: usernames } } }).exec()
  await movePin('auth', from, into)
  await Auth.deleteOne({ _id: from }).exec()
  return plan
}


// Split a combined author ("A, B & C" as one record) into one author per
// name: existing authors are reused by exact name (ignoring case), the
// rest are created, and every reference to the old author becomes the new
// list in its place. The old author is deleted unless `keep` is set or it
// is one of the names.
export async function splitAuthor(id: string, rawNames: unknown, { keep = false, ...options }: PlanOptions & { keep?: boolean } = {}) {
  const old = await Auth.findById(id).lean().exec()
  if (!old) throw httpError(404, `No author ${id}`)
  const names = [...new Set((Array.isArray(rawNames) ? rawNames : [])
    .map((n) => String(n ?? '').trim())
    .filter(Boolean))]
  if (names.length < 1) throw httpError(400, 'Give at least one name to split into')

  const targets = await Promise.all(names.map(async (name) => {
    if (name.toLowerCase() === (old.name ?? '').toLowerCase()) return { name, _id: String(old._id), existing: true }
    const found = await Auth.findOne({ name: new RegExp(`^${escapeRegexInput(name)}$`, 'i') }).lean().exec()
    return found ? { name: found.name, _id: String(found._id), existing: true } : { name, _id: null, existing: false }
  }))
  const affected = await affectedByAuthor(id)
  const keepOld = keep || targets.some((t) => t._id === String(old._id))
  const into = targets.map(({ name, _id, existing }) => ({ name, _id, existing }))
  const plan = {
    from: { _id: id, name: old.name },
    into,
    ...countsOf(affected),
    deletesOld: !keepOld,
    fingerprint: fingerprintOf({ id, into, affected, keepOld }),
  }
  if (checkPlan(plan, options)) return plan

  for (const target of targets) {
    if (!target._id) target._id = String((await Auth.create({ name: target.name }))._id)
  }
  const newIds = targets.map((t) => t._id as string)
  for (const [Model, field] of AUTHOR_FIELDS) await replaceInArrays(Model, field, id, newIds)
  if (!keepOld) {
    await Pin.deleteOne({ type: 'auth', target: id }).exec()
    await Auth.deleteOne({ _id: id }).exec()
  }
  plan.into = targets.map(({ name, _id, existing }) => ({ name, _id, existing }))
  return plan
}

// Run a plan operation for an HTTP handler: a changed plan becomes a 409
// whose data is the new plan, for the client to show and confirm.
export async function respondWithPlan(res: { status: (code: number) => { json: (body: unknown) => unknown } }, run: () => Promise<unknown>) {
  try {
    return await run()
  } catch (e) {
    if (e instanceof PlanChangedError) return res.status(409).json({ message: e.message, data: e.plan })
    throw e
  }
}

// The plan options from a request body
export const planOptionsFrom = (body: any): PlanOptions => ({
  dryRun: Boolean(body?.dryRun),
  expect: typeof body?.expect === 'string' ? body.expect : undefined,
})
