import { Auth } from '../auth/auth.model.js'
import Work from '../work/work.model.js'
import Idea from '../idea/idea.model.js'
import Pile from '../pile/pile.model.js'
import { runOcrBacklog } from '../../utils/ocrBacklog.js'

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

// In the order they should be run.
export const TASKS: MaintenanceTask[] = [trimEntityNames, addWorkIdeas, ocrBacklog]

export const findTask = (id: string) => TASKS.find((t) => t.id === id)
