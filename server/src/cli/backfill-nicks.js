import mongoose from 'mongoose'
import config from '../config/index.js'
import Note from '../resources/note/note.model.js'
import Work from '../resources/work/work.model.js'
import Idea from '../resources/idea/idea.model.js'
import Pile from '../resources/pile/pile.model.js'
import Nick from '../resources/nick/nick.model.js'
import { generateNick } from '../resources/nick/nick.controllers.js'

await mongoose.connect(config.db)
console.log('Connected.')

const types = [
  { type: 'note', Model: Note },
  { type: 'work', Model: Work },
  { type: 'idea', Model: Idea },
  { type: 'pile', Model: Pile },
]

for (const { type, Model } of types) {
  const all = await Model.find({}, { _id: 1 }).lean().exec()
  const existing = await Nick.find({ [type]: { $exists: true } }, { [type]: 1 }).lean().exec()
  const covered = new Set(existing.map(n => String(n[type])))

  const missing = all.filter(doc => !covered.has(String(doc._id)))
  console.log(`${type}: ${missing.length} missing nicks (${all.length - missing.length} already have one)`)

  let done = 0
  for (const doc of missing) {
    try {
      await generateNick(type, doc._id)
      done++
    } catch (e) {
      console.error(`  failed ${type} ${doc._id}: ${e.message}`)
    }
  }
  if (done) console.log(`  created ${done} nicks`)
}

await mongoose.disconnect()
console.log('Done.')
