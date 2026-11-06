// One delete path for every entity (#372). CASCADE says, per type, what
// refers to an entity and must go with it; deleteEntity runs those steps,
// then deletes the record, then removes its files. Every delete route goes
// through here.
//
// The cleanup steps are idempotent and all run (see runCascadeSteps). If
// any fails, the record is left in place, so retrying the delete finishes
// the job. Files go last and are best effort: a leftover file is found by
// the image reconciliation task, a missing record can't be rebuilt.
import fs from 'fs'
import config from '../config'
import Note from '../resources/note/note.model.js'
import Work from '../resources/work/work.model.js'
import Idea from '../resources/idea/idea.model.js'
import Pile from '../resources/pile/pile.model.js'
import Pin from '../resources/pin/pin.model.js'
import { Auth } from '../resources/auth/auth.model.js'
import { retireNick } from '../resources/nick/nickLifecycle.js'
import { unlinkAllFor } from '../resources/link/link.controllers.js'
import { invalidateEmbedding } from './embeddingCache.js'
import { runCascadeSteps } from './cascadeDelete.js'

export type EntityType = 'note' | 'work' | 'idea' | 'pile' | 'auth'

const MODELS: Record<EntityType, any> = { note: Note, work: Work, idea: Idea, pile: Pile, auth: Auth }

type Step = [label: string, run: () => Promise<unknown>]

// What refers to each type of entity. Stars (pins) are on all of them;
// authors have no nick.
export const CASCADE: Record<EntityType, (id: string) => Step[]> = {
  note: (id) => [
    ['links', () => unlinkAllFor(id)],
    ['nick', () => retireNick('note', id)],
    ['star', () => unpin('note', id)],
  ],
  work: (id) => [
    ['notes', () => Note.updateMany({ work: id }, { $set: { work: null } }).exec()],
    ['nick', () => retireNick('work', id)],
    ['star', () => unpin('work', id)],
  ],
  idea: (id) => [
    ['notes', () => Note.updateMany({ ideas: id }, { $pull: { ideas: id } }).exec()],
    ['works', () => Work.updateMany({ ideas: id }, { $pull: { ideas: id } }).exec()],
    ['nick', () => retireNick('idea', id)],
    ['star', () => unpin('idea', id)],
  ],
  pile: (id) => [
    ['notes', () => Note.updateMany({ piles: id }, { $pull: { piles: id } }).exec()],
    ['works', () => Work.updateMany({ piles: id }, { $pull: { piles: id } }).exec()],
    ['nick', () => retireNick('pile', id)],
    ['star', () => unpin('pile', id)],
  ],
  auth: (id) => [
    ['note authors', () => Note.updateMany({ authors: id }, { $pull: { authors: id } }).exec()],
    ['note people', () => Note.updateMany({ people: id }, { $pull: { people: id } }).exec()],
    ['work authors', () => Work.updateMany({ authors: id }, { $pull: { authors: id } }).exec()],
    ['work editors', () => Work.updateMany({ editors: id }, { $pull: { editors: id } }).exec()],
    ['work translators', () => Work.updateMany({ translators: id }, { $pull: { translators: id } }).exec()],
    ['star', () => unpin('auth', id)],
  ],
}

const unpin = (type: EntityType, id: string) => Pin.deleteMany({ type, target: String(id) }).exec()

// Delete one entity and everything that refers to it. Returns false when
// there was nothing to delete (already gone), true otherwise.
export async function deleteEntity(type: EntityType, id: string): Promise<boolean> {
  const Model = MODELS[type]
  const doc = await Model.findById(id).lean().exec()
  if (!doc) return false
  const steps = CASCADE[type](String(doc._id)).map(([label, run]) => () =>
    run().catch((e) => { throw new Error(`${label}: ${e instanceof Error ? e.message : String(e)}`) }))
  await runCascadeSteps(`delete ${type}`, steps)
  await Model.deleteOne({ _id: doc._id }).exec()
  if (type === 'note') {
    invalidateEmbedding(String(doc._id))
    await deleteNoteImageFiles(doc)
  }
  return true
}

// Remove a note's images from disk: each file it lists, then its whole
// <imageStorePath>/<noteId>/ directory, which also catches files the note
// no longer lists (e.g. an upload whose DB update failed). The directory
// name comes from the stored _id, never the request: Mongoose accepts any
// 12-character string as an ObjectId, so a URL param isn't safe to rm -r.
async function deleteNoteImageFiles(note: { _id: unknown; images?: string[] }) {
  await Promise.allSettled(
    (note.images ?? []).map((img) => fs.promises.unlink(config.imageStorePath + '/' + img))
  )
  const noteId = String(note._id)
  if (!/^[0-9a-f]{24}$/.test(noteId)) return
  await fs.promises
    .rm(config.imageStorePath + '/' + noteId, { recursive: true, force: true })
    .catch((e) => console.error(`Could not remove images for note ${noteId}`, e))
}
