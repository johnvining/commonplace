import { Auth } from '../auth/auth.model.js'
import Work from '../work/work.model.js'
import Idea from '../idea/idea.model.js'
import Pile from '../pile/pile.model.js'
import { runOcrBacklog } from '../../utils/ocrBacklog.js'
import Note from '../note/note.model.js'
import { cleanOcrText } from '../../utils/ocrText.js'
import Pin from '../pin/pin.model.js'
import fs from 'fs'
import path from 'path'
import config from '../../config'
import { countOutdatedEmbeddings } from '../../utils/embeddingRefresh.js'
import { isOcrConfigured } from '../../utils/autoOcr.js'
import Link from '../link/link.model.js'
import { findOrCreatePile } from '../pile/pile.controllers.js'
import { canonicalPair } from '../link/link.controllers.js'
import Nick from '../nick/nick.model.js'
import { mintNick, type NickEntityType } from '../nick/nickLifecycle.js'

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
      { text: 1, title: 1, textSource: 1 }
    ).lean()
    // Only text that isn't marked as the user's; old bulk OCR left its
    // text unmarked, so unmarked text still counts (#379)
    const refusals = candidates.filter(
      (n) => n.text?.trim() && cleanOcrText(n.text) === '' && n.textSource !== 'user'
    )
    for (const n of refusals) log(`  ${n._id} ${n.title ?? '(no title)'}: "${n.text?.trim().slice(0, 70)}"`)
    if (!dryRun && refusals.length) {
      await Note.updateMany(
        { _id: { $in: refusals.map((n) => n._id) } },
        // Out of the ocr state, back to blank
        { $set: { text: '', ocrText: '', textSource: 'blank' } },
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

const NICK_MODELS: Record<NickEntityType, any> = { note: Note, work: Work, idea: Idea, pile: Pile, auth: Auth }
const LIST_LIMIT = 20

// The unique indexes on nicks are what stop a key being shared, or a thing
// getting a second nick, when two saves race. A database holding
// duplicates can't build them, and the server then runs without them.
const repairNicks: MaintenanceTask = {
  id: 'repair-nicks',
  title: 'Repair nicks',
  issue: 347,
  description:
    'Nick keys must be unique, and each note, work, idea and pile may have ' +
    'only one live nick. Unique indexes enforce both, but they cannot be ' +
    'built while duplicates exist. Keeps the oldest row of each repeated key ' +
    '(the one lookups already found) and removes the rest. When a thing has ' +
    'several nicks, keeps the oldest and turns the others into aliases that ' +
    'still lead to it, so no link breaks. Marks rows pointing at deleted ' +
    'things retired. Then builds the indexes, and gives a nick to anything ' +
    'a removed row leaves without one. Dry run lists every change.',
  async run({ dryRun, log }) {
    const types = Object.keys(NICK_MODELS) as NickEntityType[]
    const live: Record<string, Set<string>> = {}
    for (const t of types) live[t] = new Set((await NICK_MODELS[t].distinct('_id')).map(String))
    const refOf = (row: any) => {
      const type = types.find((t) => row[t])
      return type ? { type, id: String(row[type]) } : null
    }

    // Oldest first: with no index, a lookup found the first row inserted
    const rows = await Nick.find({}).sort({ _id: 1 }).lean()
    const keys = new Set<string>()
    const owners = new Set<string>()
    const remove: any[] = [], retire: any[] = [], alias: { row: any; to: string }[] = []
    for (const row of rows) {
      const ref = refOf(row)
      if (row.key && keys.has(row.key)) { remove.push(row); continue }
      if (row.key) keys.add(row.key)
      if (!ref) continue
      if (!live[ref.type].has(ref.id)) { retire.push(row); continue }
      const owner = ref.type + ':' + ref.id
      if (owners.has(owner)) alias.push({ row, to: ref.id })
      else owners.add(owner)
    }
    // Live things whose only nick was a removed duplicate key
    const orphans = remove
      .map(refOf)
      .filter((ref): ref is { type: NickEntityType; id: string } => !!ref && live[ref.type].has(ref.id))
      .filter((ref) => !owners.has(ref.type + ':' + ref.id))
      .filter((ref, i, all) => all.findIndex((o) => o.type === ref.type && o.id === ref.id) === i)

    const verb = dryRun ? 'would' : 'did'
    const list = (label: string, items: string[]) => {
      for (const line of items.slice(0, LIST_LIMIT)) log(`  ${label}: ${line}`)
      if (items.length > LIST_LIMIT) log(`  …and ${items.length - LIST_LIMIT} more`)
    }
    const describe = (row: any) => {
      const ref = refOf(row)
      return `${row.key ?? '(no key)'}${ref ? ` → ${ref.type} ${ref.id}` : ''}`
    }
    log(`nicks: ${rows.length} checked`)
    log(`repeated keys: ${verb} remove ${remove.length} later copies`)
    list('remove', remove.map(describe))
    log(`second nicks: ${verb} turn ${alias.length} into aliases of the oldest`)
    list('alias', alias.map(({ row }) => describe(row)))
    log(`deleted things: ${verb} mark ${retire.length} nicks retired`)
    list('retire', retire.map(describe))
    log(`left without a nick: ${orphans.length}, ${verb} get a new one`)
    list('new nick', orphans.map((o) => `${o.type} ${o.id}`))

    if (dryRun) return
    const now = new Date()
    if (remove.length) await Nick.deleteMany({ _id: { $in: remove.map((r) => r._id) } })
    for (const { row, to } of alias) {
      const type = refOf(row)!.type
      await Nick.updateOne(
        { _id: row._id },
        { $unset: { [type]: 1 }, $set: { mergedInto: to, retired: true, retiredAt: now } }
      )
    }
    for (const row of retire) {
      const type = refOf(row)!.type
      await Nick.updateOne(
        { _id: row._id },
        { $unset: { [type]: 1 }, $set: { retired: true, ...(row.retiredAt ? {} : { retiredAt: now }) } }
      )
    }
    await Nick.syncIndexes()
    log('unique indexes built: key, note, work, idea, pile, author')
    for (const o of orphans) {
      const row = await mintNick(o.type, o.id)
      log(`  ${o.type} ${o.id} now ${row?.key}`)
    }
  },
}

// Piles the image check files notes into, one per kind of problem. The
// shared prefix keeps them together in pile lists.
export const IMAGE_CHECK_PILES = {
  missing: 'Images: Missing file',
  blank: 'Images: Blank entry',
  unlisted: 'Images: Unlisted file',
} as const

// Report only: it never moves, deletes or edits an image, or a note's list
// of them. Its one write is filing notes into the piles above.
const reconcileImages: MaintenanceTask = {
  id: 'reconcile-images',
  title: 'Check image files against notes',
  issue: 368,
  description:
    'A note\'s images are files on disk plus a list on the note, written in ' +
    'separate steps, so they can drift apart. Changes no image and no ' +
    'image list: it files each affected note into a pile, so you can find ' +
    'and fix them. "Images: Missing file" lists an image whose file is ' +
    'gone. "Images: Blank entry" lists an empty image name, where a file ' +
    'name was lost. "Images: Unlisted file" has files in its folder it ' +
    'doesn\'t list. Re-running brings the piles up to date. Files in ' +
    'folders of deleted notes are only counted. Dry run gives the counts.',
  async run({ dryRun, log }) {
    const root = config.imageStorePath
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(root, { withFileTypes: true })
    } catch {
      throw new Error(`Can't read the image store at ${root}`)
    }
    const notes = await Note.find({}, { images: 1 }).lean()
    const noteIds = new Set(notes.map((n) => String(n._id)))
    const isEmpty = (image: unknown) => typeof image !== 'string' || !image.trim()
    const named = (images: unknown[] | undefined) => (images ?? []).filter((i): i is string => !isEmpty(i))
    const listed = new Set(notes.flatMap((n) => named(n.images)))

    // Only folders named by a note id hold note images
    const unlistedByNote = new Map<string, number>()
    const strayFiles: string[] = []
    for (const dir of entries) {
      if (!dir.isDirectory() || !/^[0-9a-f]{24}$/.test(dir.name)) continue
      for (const file of await fs.promises.readdir(path.join(root, dir.name), { withFileTypes: true })) {
        const rel = dir.name + '/' + file.name
        if (!file.isFile() || listed.has(rel)) continue
        if (noteIds.has(dir.name)) unlistedByNote.set(dir.name, (unlistedByNote.get(dir.name) ?? 0) + 1)
        else strayFiles.push(rel)
      }
    }

    const missing: string[] = [], blank: string[] = []
    let missingFiles = 0, blankEntries = 0
    for (const note of notes) {
      const id = String(note._id)
      const lost = named(note.images).filter((image) => !fs.existsSync(path.join(root, image))).length
      if (lost) { missing.push(id); missingFiles += lost }
      const empty = (note.images ?? []).filter(isEmpty).length
      if (empty) { blank.push(id); blankEntries += empty }
    }
    const unlisted = [...unlistedByNote.keys()]
    const unlistedFiles = [...unlistedByNote.values()].reduce((a, b) => a + b, 0)

    const verb = dryRun ? 'would file' : 'filed'
    log(`${IMAGE_CHECK_PILES.missing}: ${missing.length} notes (${missingFiles} of ${listed.size} listed files gone)` +
      `, ${verb}`)
    log(`${IMAGE_CHECK_PILES.blank}: ${blank.length} notes (${blankEntries} empty names), ${verb}`)
    log(`${IMAGE_CHECK_PILES.unlisted}: ${unlisted.length} notes (${unlistedFiles} files), ${verb}`)
    log(`files in folders of deleted notes: ${strayFiles.length}, left alone` +
      (strayFiles.length ? ' — ' + strayFiles.slice(0, 20).join(', ') + (strayFiles.length > 20 ? `, …${strayFiles.length - 20} more` : '') : ''))
    if (dryRun) return

    const file = async (name: string, ids: string[]) => {
      // Only make a pile when there's something to put in it
      const pile = ids.length ? await findOrCreatePile(name) : await Pile.findOne({ name }).lean()
      if (!pile) return
      if (ids.length) await Note.updateMany({ _id: { $in: ids } }, { $addToSet: { piles: pile._id } }, { timestamps: false })
      // Notes fixed since the last run leave the pile
      await Note.updateMany({ piles: pile._id, _id: { $nin: ids } }, { $pull: { piles: pile._id } }, { timestamps: false })
    }
    await file(IMAGE_CHECK_PILES.missing, missing)
    await file(IMAGE_CHECK_PILES.blank, blank)
    await file(IMAGE_CHECK_PILES.unlisted, unlisted)
  },
}

const refreshEmbeddings: MaintenanceTask = {
  id: 'refresh-embeddings',
  title: 'Refresh search embeddings',
  issue: 373,
  description:
    'Edits now keep search embeddings current, but some older ones (bulk OCR, ' +
    'bulk titles, bulk updates) changed notes without re-embedding them. ' +
    'Re-embeds every note whose embedding no longer matches its content. Uses ' +
    'OpenAI, one call per outdated note. Dry run counts them without calling it.',
  async run({ dryRun, log }) {
    if (dryRun) {
      log(`${await countOutdatedEmbeddings()} notes have an outdated or missing embedding`)
      return
    }
    if (!isOcrConfigured()) throw new Error('No OpenAI key configured (OPENAI_API_KEY)')
    const { embedStaleNotes } = await import('../note/note.controllers.js')
    const { processed, skipped, failed } = await embedStaleNotes()
    log(`re-embedded ${processed}, already current ${skipped}, failed ${failed}`)
    if (failed) throw new Error(`${failed} notes failed`)
  },
}

const clearUnratedReviewDates: MaintenanceTask = {
  id: 'clear-unrated-review-dates',
  title: 'Clear review dates on notes never rated',
  issue: 380,
  description:
    'An early version set a note\'s review date when it was edited, so some ' +
    'notes look reviewed without ever being rated. Review state already ' +
    'ignores those dates; this clears them (and any due date) from notes with ' +
    'no ratings, leaving updatedAt alone. Dry run counts them.',
  async run({ dryRun, log }) {
    const query = {
      reviewCount: { $not: { $gt: 0 } },
      $or: [{ reviewedAt: { $ne: null } }, { reviewDueAt: { $ne: null } }],
    }
    const count = await Note.countDocuments(query)
    if (!dryRun && count) {
      await Note.updateMany(query, { $unset: { reviewedAt: 1, reviewDueAt: 1, reviewInterval: 1 } }, { timestamps: false })
    }
    log(`${count} never-rated notes with review dates${count ? (dryRun ? ', would clear' : ', cleared') : ''}`)
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
  repairNicks,
  reconcileImages,
  refreshEmbeddings,
  clearUnratedReviewDates,
]

export const findTask = (id: string) => TASKS.find((t) => t.id === id)
