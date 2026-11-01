// Write to many notes in one request (#356). Maintenance jobs used to be
// one CLI call per note, each a fresh process and round trip, which is
// what pushed them toward direct database edits. These run through
// Mongoose, so timestamps bump as for single-note edits.
import mongoose from 'mongoose'
import Note from '../resources/note/note.model.js'
import Work from '../resources/work/work.model.js'
import Idea from '../resources/idea/idea.model.js'
import Pile from '../resources/pile/pile.model.js'
import { escapeRegexInput } from './searchInput.js'

const MAX_IDS = 5000

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status })
}

function objectIds(value: unknown, label: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some((v) => !mongoose.isValidObjectId(v))) {
    throw httpError(400, `${label} must be a list of ids`)
  }
  return value.map(String)
}

interface BulkChanges {
  ids?: unknown
  // An id sets the work, null clears it
  work?: unknown
  // Replace the authors
  authors?: unknown
  // Added to what each note has
  ideas?: unknown
  piles?: unknown
}

export async function bulkUpdateNotes(body: BulkChanges) {
  const ids = objectIds(body.ids, 'ids')
  if (!ids.length) throw httpError(400, 'No note ids given')
  if (ids.length > MAX_IDS) throw httpError(400, `At most ${MAX_IDS} notes at a time`)

  const $set: Record<string, unknown> = {}
  const $addToSet: Record<string, unknown> = {}
  if (body.work !== undefined) {
    if (body.work !== null && !mongoose.isValidObjectId(body.work)) throw httpError(400, 'work must be an id or null')
    $set.work = body.work
  }
  if (body.authors !== undefined) $set.authors = objectIds(body.authors, 'authors')
  const ideas = objectIds(body.ideas, 'ideas')
  const piles = objectIds(body.piles, 'piles')
  if (ideas.length) $addToSet.ideas = { $each: ideas }
  if (piles.length) $addToSet.piles = { $each: piles }
  if (!Object.keys($set).length && !Object.keys($addToSet).length) throw httpError(400, 'Nothing to change')

  const update: Record<string, unknown> = {}
  if (Object.keys($set).length) update.$set = $set
  if (Object.keys($addToSet).length) update.$addToSet = $addToSet
  const result = await Note.updateMany({ _id: { $in: ids } }, update).exec()

  // Ideas and piles sort by when they last changed
  const now = { $set: { updatedAt: new Date() } }
  if (ideas.length) await Idea.updateMany({ _id: { $in: ideas } }, now).exec()
  if (piles.length) await Pile.updateMany({ _id: { $in: piles } }, now).exec()
  return { matched: result.matchedCount, modified: result.modifiedCount }
}

// Link notes whose title is exactly `title` (ignoring case and outer
// spaces) to a work. The title defaults to the work's name. Only notes
// with no work are linked, unless `all` is set, which also moves notes
// from other works.
export async function linkNotesByTitle(body: { work?: unknown; title?: unknown; all?: unknown; dryRun?: unknown }) {
  if (!mongoose.isValidObjectId(body.work)) throw httpError(400, 'work must be an id')
  const work = await Work.findById(body.work).lean().exec()
  if (!work) throw httpError(404, `No work ${body.work}`)
  const title = String(body.title ?? work.name ?? '').trim()
  if (!title) throw httpError(400, 'No title to match')

  const query: Record<string, unknown> = {
    title: new RegExp(`^\\s*${escapeRegexInput(title)}\\s*$`, 'i'),
    work: body.all ? { $ne: work._id } : null,
  }
  const notes = await Note.find(query, { _id: 1, title: 1, work: 1 }).lean().exec()
  const plan = {
    work: { _id: String(work._id), name: work.name },
    title,
    matched: notes.length,
    fromOtherWorks: notes.filter((n) => n.work).length,
    notes: notes.slice(0, 50).map((n) => ({ _id: n._id, title: n.title })),
  }
  if (body.dryRun || !notes.length) return plan
  await Note.updateMany({ _id: { $in: notes.map((n) => n._id) } }, { $set: { work: work._id } }).exec()
  return plan
}
