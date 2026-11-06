// Merging duplicate works and authors (#360), and splitting a combined
// author into several (#356). Everything goes through Mongoose so
// timestamps bump: changed notes surface on the home feed. With dryRun
// the plan comes back and nothing is written, so the CLI can show what
// will change before asking.
import Work from '../resources/work/work.model.js'
import Note from '../resources/note/note.model.js'
import Pin from '../resources/pin/pin.model.js'
import { Auth } from '../resources/auth/auth.model.js'
import { deleteNickFor } from '../resources/nick/nick.controllers.js'
import { escapeRegexInput } from './searchInput.js'

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status })
}

const ids = (list: unknown[] | undefined) => (list ?? []).map(String)

// Ids in `extra` that `base` lacks, in order
const missingFrom = (base: unknown[] | undefined, extra: unknown[] | undefined) => {
  const have = new Set(ids(base))
  return ids(extra).filter((id) => !have.has(id))
}

// Point the from-entity's star at the kept one, or drop it when the kept
// one is starred already.
async function movePin(type: string, from: string, into: string) {
  const pin = await Pin.findOne({ type, target: from }).exec()
  if (!pin) return false
  if (await Pin.exists({ type, target: into })) await Pin.deleteOne({ _id: pin._id }).exec()
  else await Pin.updateOne({ _id: pin._id }, { $set: { target: into } }).exec()
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

export async function mergeWorks(from: string, into: string, dryRun = false) {
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
  const notes = await Note.countDocuments({ work: from })
  const plan = {
    from: { _id: from, name: fromWork.name },
    into: { _id: into, name: intoWork.name },
    notes,
    piles: piles.length,
    ideas: ideas.length,
    authors: authors.length,
    editors: editors.length,
    translators: translators.length,
    fields: Object.keys(fill),
  }
  if (dryRun) return plan

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
  await deleteNickFor('work', from, into)
  await Work.deleteOne({ _id: from }).exec()
  return plan
}

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

export async function mergeAuthors(from: string, into: string, dryRun = false) {
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

  const [notes, notesAbout, works, edited, translated] = await Promise.all([
    Note.countDocuments({ authors: from }),
    Note.countDocuments({ people: from }),
    Work.countDocuments({ authors: from }),
    Work.countDocuments({ editors: from }),
    Work.countDocuments({ translators: from }),
  ])
  const plan = {
    from: { _id: from, name: fromAuth.name },
    into: { _id: into, name: intoAuth.name },
    notes,
    notesAbout,
    works,
    edited,
    translated,
    fields: [...Object.keys(fill), ...(usernames.length ? ['usernames'] : [])],
  }
  if (dryRun) return plan

  await replaceInArrays(Note, 'authors', from, into)
  await replaceInArrays(Note, 'people', from, into)
  await replaceInArrays(Work, 'authors', from, into)
  await replaceInArrays(Work, 'editors', from, into)
  await replaceInArrays(Work, 'translators', from, into)
  await Auth.updateOne({ _id: into }, { $set: fill, $push: { usernames: { $each: usernames } } }).exec()
  await movePin('auth', from, into)
  await Auth.deleteOne({ _id: from }).exec()
  return plan
}

// Every array that can hold an author
const AUTHOR_FIELDS: [any, string][] = [
  [Note, 'authors'],
  [Note, 'people'],
  [Work, 'authors'],
  [Work, 'editors'],
  [Work, 'translators'],
]

// Split a combined author ("A, B & C" as one record) into one author per
// name: existing authors are reused by exact name (ignoring case), the
// rest are created, and every reference to the old author becomes the new
// list in its place. The old author is deleted unless `keep` is set or it
// is one of the names.
export async function splitAuthor(id: string, rawNames: unknown, { keep = false, dryRun = false } = {}) {
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
  const counts = await Promise.all(AUTHOR_FIELDS.map(([Model, field]) => Model.countDocuments({ [field]: id })))
  const keepOld = keep || targets.some((t) => t._id === String(old._id))
  const plan = {
    from: { _id: id, name: old.name },
    into: targets.map(({ name, _id, existing }) => ({ name, _id, existing })),
    notes: counts[0],
    notesAbout: counts[1],
    works: counts[2],
    edited: counts[3],
    translated: counts[4],
    deletesOld: !keepOld,
  }
  if (dryRun) return plan

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
