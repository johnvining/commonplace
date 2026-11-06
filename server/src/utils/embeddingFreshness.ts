// Embedding freshness as one maintained invariant (#373): a note whose
// embedding inputs change is marked embeddingStale, by hooks on the
// models, on every kind of write, and the refresher (embeddingRefresh.ts)
// re-embeds stale notes in the background. No call site has to remember.
import type { Schema } from 'mongoose'

// The note fields buildEmbeddingInput reads
export const EMBED_INPUTS = ['title', 'text', 'take', 'ocrText', 'authors', 'people', 'work', 'ideas']

const UPDATE_OPERATORS = ['$set', '$unset', '$push', '$pull', '$addToSet', '$pullAll']

function touches(update: any, fields: string[]): boolean {
  if (!update || Array.isArray(update)) return false
  const keys = [
    ...Object.keys(update).filter((k) => !k.startsWith('$')),
    ...UPDATE_OPERATORS.flatMap((op) => Object.keys(update[op] ?? {})),
  ]
  return keys.some((k) => fields.includes(k.split('.')[0]))
}

// Writing a new embedding never marks the note stale, even when it also
// stores the OCR text it was built from.
const writesEmbedding = (update: any) => touches(update, ['embedding'])

const schedule = () =>
  import('./embeddingRefresh.js')
    .then((m) => m.scheduleEmbeddingRefresh())
    .catch((e) => console.error('[embed] could not schedule a refresh', e))

export function trackEmbeddingFreshness(schema: Schema) {
  schema.pre('save', function () {
    const changed = this.isNew || EMBED_INPUTS.some((f) => this.isModified(f))
    if (changed && !this.isModified('embedding')) this.set('embeddingStale', true)
  })
  schema.post('save', function (doc: any) {
    if (doc.embeddingStale) schedule()
  })
  for (const op of ['findOneAndUpdate', 'updateOne', 'updateMany'] as const) {
    schema.pre(op, function () {
      const update: any = this.getUpdate()
      if (writesEmbedding(update) || !touches(update, EMBED_INPUTS)) return
      update.$set = { ...(update.$set ?? {}), embeddingStale: true }
      ;(this as any)._embeddingTouched = true
    })
    schema.post(op, function () {
      if ((this as any)._embeddingTouched) schedule()
    })
  }
}

// A note's embedding includes the names of its work, ideas, authors and
// people, so renaming one of those makes its notes stale too.
export function markNotesStaleOnRename(schema: Schema, noteFields: string[]) {
  for (const op of ['findOneAndUpdate', 'updateOne'] as const) {
    schema.post(op, async function () {
      const update: any = this.getUpdate()
      const id = (this.getQuery() as any)?._id
      if (!id || !touches(update, ['name'])) return
      try {
        const { default: Note } = await import('../resources/note/note.model.js')
        await Note.updateMany(
          { $or: noteFields.map((f) => ({ [f]: id })) },
          { $set: { embeddingStale: true } },
          { timestamps: false }
        )
        schedule()
      } catch (e) {
        console.error('[embed] could not mark renamed entity notes stale', e)
      }
    })
  }
}
