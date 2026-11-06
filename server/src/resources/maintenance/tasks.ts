import { Auth } from '../auth/auth.model.js'
import Work from '../work/work.model.js'
import Idea from '../idea/idea.model.js'
import Pile from '../pile/pile.model.js'
import { runOcrBacklog } from '../../utils/ocrBacklog.js'
import Note from '../note/note.model.js'
import { cleanOcrText } from '../../utils/ocrText.js'
import Pin from '../pin/pin.model.js'
import Link from '../link/link.model.js'
import { canonicalPair } from '../link/link.controllers.js'

export interface TaskContext {
  dryRun: boolean
  log: (line: string) => void
}

// A one-off data fix to run after deploying an update. Every task must be
// safe to run more than once, and must change nothing when dryRun is set.
export interface MaintenanceTask {
  id: string
  title: string
  issue: number
  description: string
  run: (ctx: TaskContext) => Promise<void>
}

const NAMED_MODELS = [
  { label: 'authors', Model: Auth },
  { label: 'works', Model: Work },
  { label: 'ideas', Model: Idea },
  { label: 'piles', Model: Pile },
] as const

const trimEntityNames: MaintenanceTask = {
  id: 'trim-entity-names',
  title: 'Trim author, work, idea and pile names',
  issue: 51,
  description:
    'Names are now trimmed on save, and lookups trim what you type, so a name ' +
    'stored with stray spaces (" Stoicism") can no longer be found and the next ' +
    'import would make a duplicate. Trims stored names. Lists blank names and ' +
    'names that clash after trimming, to fix by hand.',
  async run({ dryRun, log }) {
    for (const { label, Model } of NAMED_MODELS) {
      const coll = Model.collection
      const untrimmed = { name: { $type: 'string', $regex: /^\s|\s$/ } }
      const count = await coll.countDocuments(untrimmed)
      if (!dryRun && count) {
        await coll.updateMany(untrimmed, [{ $set: { name: { $trim: { input: '$name' } } } }])
      }
      const blank = await coll
        .find({ $or: [{ name: { $exists: false } }, { name: null }, { name: /^\s*$/ }] }, { projection: { _id: 1 } })
        .toArray()
      const clashes = await coll
        .aggregate([
          { $match: { name: { $type: 'string' } } },
          { $group: { _id: { $trim: { input: '$name' } }, count: { $sum: 1 } } },
          { $match: { _id: { $ne: '' }, count: { $gt: 1 } } },
        ])
        .toArray()
      log(`${label}: ${dryRun ? 'would trim' : 'trimmed'} ${count}, blank ${blank.length}`)
      if (blank.length) log(`  blank ids: ${blank.map((d) => String(d._id)).join(', ')}`)
      if (clashes.length) {
        log(`  same name after trimming: ${clashes.map((c) => `"${c._id}" x${c.count}`).join(', ')}`)
      }
    }
  },
}

const addWorkIdeas: MaintenanceTask = {
  id: 'add-work-ideas',
  title: 'Give every work an ideas list',
  issue: 216,
  description:
    'Optional. Mongoose already treats a missing ideas list as empty; this makes ' +
    'the stored works consistent.',
  async run({ dryRun, log }) {
    const missing = { ideas: { $exists: false } }
    const count = await Work.collection.countDocuments(missing)
    if (!dryRun && count) await Work.collection.updateMany(missing, { $set: { ideas: [] } })
    log(`works: ${dryRun ? 'would update' : 'updated'} ${count}`)
  },
}

const ocrBacklog: MaintenanceTask = {
  id: 'ocr-backlog',
  title: 'Fill in text for old image notes',
  issue: 305,
  description:
    'Reads the images of notes that have images but no text, and fills in the ' +
    'text. Uses OpenAI (one call per image not already read); notes with text ' +
    'are never touched. Dry run shows how many notes and calls.',
  async run({ dryRun, log }) {
    const { failed } = await runOcrBacklog({ dryRun, log })
    if (failed) throw new Error(`${failed} notes failed`)
  },
}

const clearOcrRefusals: MaintenanceTask = {
  id: 'clear-ocr-refusals',
  title: 'Clear "can\'t transcribe" text from image notes',
  issue: 0,
  description:
    'Reading an image with no text (a photo, a painting) used to save the ' +
    'apology as the note\'s text: "Sorry, I can\'t transcribe the text from ' +
    'this image." Clears that text (and its OCR copy) on image notes. Only ' +
    'text that is nothing but such an apology is touched. Dry run lists them.',
  async run({ dryRun, log }) {
    const candidates = await Note.find(
      { 'images.0': { $exists: true }, text: { $regex: /transcri|text|NO_TEXT/i } },
      { text: 1, title: 1 }
    ).lean()
    const refusals = candidates.filter((n) => n.text?.trim() && cleanOcrText(n.text) === '')
    for (const n of refusals) log(`  ${n._id} ${n.title ?? '(no title)'}: "${n.text?.trim().slice(0, 70)}"`)
    if (!dryRun && refusals.length) {
      await Note.updateMany(
        { _id: { $in: refusals.map((n) => n._id) } },
        { $set: { text: '', ocrText: '' } },
        { timestamps: false }
      )
    }
    log(`${dryRun ? 'would clear' : 'cleared'} ${refusals.length} of ${candidates.length} image notes checked`)
  },
}

// Every field that holds author ids
const AUTHOR_REFS = [
  { label: 'note authors', Model: Note, field: 'authors' },
  { label: 'note people', Model: Note, field: 'people' },
  { label: 'work authors', Model: Work, field: 'authors' },
  { label: 'work editors', Model: Work, field: 'editors' },
  { label: 'work translators', Model: Work, field: 'translators' },
] as const

const removeMissingAuthors: MaintenanceTask = {
  id: 'remove-missing-authors',
  title: 'Remove links to deleted authors',
  issue: 345,
  description:
    'Notes and works could still list an author whose record is gone, so the ' +
    'author link 404ed. Removes those ids from notes (by and about) and works ' +
    '(authors, editors, translators), and unstars them. Dry run lists the ' +
    'missing ids and how many records each would change.',
  async run({ dryRun, log }) {
    const existing = new Set((await Auth.distinct('_id')).map(String))
    for (const { label, Model, field } of AUTHOR_REFS) {
      const missing = ((await (Model as any).distinct(field)) as unknown[]).filter(
        (id) => id != null && !existing.has(String(id))
      )
      const query = { [field]: { $in: missing } }
      const count = missing.length ? await (Model as any).countDocuments(query) : 0
      if (!dryRun && count) {
        await (Model as any).updateMany(query, { $pullAll: { [field]: missing } }, { timestamps: false })
      }
      log(`${label}: ${missing.length} missing authors on ${count} records${count ? (dryRun ? ', would remove' : ', removed') : ''}`)
      if (missing.length) log(`  missing ids: ${missing.map(String).join(', ')}`)
    }
    const pins = (await Pin.find({ type: 'auth' }, { target: 1 }).lean()).filter((p) => !existing.has(p.target))
    if (!dryRun && pins.length) await Pin.deleteMany({ _id: { $in: pins.map((p) => p._id) } })
    log(`stars: ${pins.length} on missing authors${pins.length ? (dryRun ? ', would remove' : ', removed') : ''}`)
  },
}

const tidyNoteLinks: MaintenanceTask = {
  id: 'tidy-note-links',
  title: 'Tidy note links',
  issue: 371,
  description:
    'Links are now stored once per pair, smaller note id first, under a ' +
    'unique index. Puts existing links in that order, removes duplicates, ' +
    'links from a note to itself and links to deleted notes, then builds ' +
    'the index. Dry run counts each kind.',
  async run({ dryRun, log }) {
    const links = await Link.find({}, { left_note: 1, right_note: 1 }).lean()
    const noteIds = new Set((await Note.distinct('_id')).map(String))
    const seen = new Set<string>()
    const remove: unknown[] = []
    const reorder: { id: unknown; left: string; right: string }[] = []
    let self = 0, dangling = 0, duplicate = 0
    for (const link of links) {
      const [left, right] = canonicalPair(link.left_note, link.right_note)
      if (left === right) { self++; remove.push(link._id); continue }
      if (!noteIds.has(left) || !noteIds.has(right)) { dangling++; remove.push(link._id); continue }
      const pair = left + ':' + right
      if (seen.has(pair)) { duplicate++; remove.push(link._id); continue }
      seen.add(pair)
      if (String(link.left_note) !== left) reorder.push({ id: link._id, left, right })
    }
    if (!dryRun) {
      if (remove.length) await Link.deleteMany({ _id: { $in: remove } })
      for (const r of reorder) {
        await Link.updateOne({ _id: r.id }, { $set: { left_note: r.left, right_note: r.right } }, { timestamps: false })
      }
      await Link.syncIndexes()
    }
    const verb = dryRun ? 'would' : 'did'
    log(`links: ${links.length} checked; ${verb} remove ${self} self-links, ${dangling} to deleted notes, ` +
      `${duplicate} duplicates; ${verb} reorder ${reorder.length}`)
    if (!dryRun) log('unique pair index built')
  },
}

// In the order they should be run.
export const TASKS: MaintenanceTask[] = [
  trimEntityNames,
  addWorkIdeas,
  ocrBacklog,
  clearOcrRefusals,
  removeMissingAuthors,
  tidyNoteLinks,
]

export const findTask = (id: string) => TASKS.find((t) => t.id === id)
