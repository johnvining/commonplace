// Where a note's title came from, so the AI mark is a recorded fact, not a
// guess from comparing strings (#370).
//
//   user          typed, pasted or imported
//   ai-suggested  AI wrote it with nobody choosing it (bulk suggest)
//   ai-accepted   someone took an AI suggestion into the editor and saved it
//
// aiTitle stays the last suggestion made for the note; it's what an
// ai-* title is checked against, not the mark itself.
import type { Schema } from 'mongoose'
import { getSuggestedTitle } from './suggestions.js'

export type TitleSource = 'user' | 'ai-suggested' | 'ai-accepted'
export const TITLE_SOURCES: TitleSource[] = ['user', 'ai-suggested', 'ai-accepted']

interface NoteTitleFields {
  title?: string | null
  aiTitle?: string | null
  titleSource?: string | null
}

// The one place a note's title source is read. null means not sure: a
// note saved before titleSource existed, whose title nobody has changed
// since. Nothing is inferred from the title itself; the source is set
// only when the title is typed (user) or written by AI.
export function titleSourceOf(note: NoteTitleFields): TitleSource | null {
  return TITLE_SOURCES.includes(note.titleSource as TitleSource) ? (note.titleSource as TitleSource) : null
}

// A title claimed as AI-made only counts if it is the note's last
// suggestion; anything else is the user's.
export function checkedTitleSource(claimed: unknown, title: unknown, aiTitle: unknown): TitleSource {
  const isAi = claimed === 'ai-accepted' || claimed === 'ai-suggested'
  return isAi && typeof title === 'string' && title && title === aiTitle ? (claimed as TitleSource) : 'user'
}

// The one suggestion path, for one note or many. Always remembers the
// suggestion as aiTitle. With `apply`, also makes it the title, but only
// while the note still has none, and marks it ai-suggested. Returns the
// suggestion and whether it became the title.
export async function suggestTitle(Note: any, note: { _id: unknown; text?: string | null }, { apply = false } = {}) {
  const suggestion = await getSuggestedTitle(note.text ?? '')
  if (!suggestion) return { suggestion, applied: false }
  if (apply) {
    const result = await Note.updateOne(
      { _id: note._id, $or: [{ title: { $exists: false } }, { title: null }, { title: '' }] },
      { $set: { title: suggestion, aiTitle: suggestion, titleSource: 'ai-suggested' } }
    ).exec()
    if (result.modifiedCount) return { suggestion, applied: true }
  }
  await Note.updateOne({ _id: note._id }, { $set: { aiTitle: suggestion } }).exec()
  return { suggestion, applied: false }
}

// Record a write of `title` that doesn't say where it came from as the
// user's, on saves and on every kind of update. A single-note write that
// leaves the title as it was keeps its source, so a client resending the
// whole note can't clear the AI mark; the editor says 'user' outright when
// the title was typed.
export function trackTitleSource(schema: Schema) {
  schema.pre('save', function () {
    if (this.isModified('title') && !this.isModified('titleSource')) this.set('titleSource', 'user')
  })
  for (const op of ['findOneAndUpdate', 'updateOne', 'updateMany'] as const) {
    schema.pre(op, async function () {
      const update: any = this.getUpdate()
      if (!update || Array.isArray(update)) return
      const $set = update.$set ?? {}
      if ('titleSource' in update || 'titleSource' in $set) return
      const target = 'title' in update ? update : 'title' in $set ? $set : null
      if (!target) return
      if (op !== 'updateMany') {
        const current: any = await this.model.findOne(this.getQuery(), { title: 1 }).lean()
        if (current && (current.title ?? '') === (target.title ?? '')) return
      }
      target.titleSource = 'user'
    })
  }
}
