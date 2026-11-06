// Re-embeds stale notes (see embeddingFreshness.ts) and keeps the search
// cache in step: saveEmbedding is the one way an embedding is written,
// and it updates Mongo and the cache together (#373).
import Note from '../resources/note/note.model.js'
import config from '../config'
import { embedNoteIfStale, buildEmbeddingInput, hashContent } from './embeddings.js'
import { upsertEmbedding } from './embeddingCache.js'

type EmbeddingUpdate = NonNullable<Awaited<ReturnType<typeof embedNoteIfStale>>>

// Notes needing an embedding: marked stale, or never embedded and never
// found to have nothing to embed
export const STALE = {
  $or: [{ embeddingStale: true }, { embeddingHash: { $exists: false }, embeddingStale: { $exists: false } }],
}

const populated = (query: any) =>
  query
    .populate('authors')
    .populate('people')
    .populate('ideas')
    .populate({ path: 'work', populate: { path: 'authors' } })
    .lean()
    .exec()

// Write an embedding and mark the note fresh, in Mongo and in the cache.
// With `readAt` (the note's updatedAt when it was read), skip the write if
// the note was edited since, leaving it stale for the next pass. Doesn't
// touch updatedAt, so embedding a note doesn't move it up the home feed.
export async function saveEmbedding(noteId: unknown, update: EmbeddingUpdate | null, readAt?: Date) {
  const filter: Record<string, unknown> = { _id: noteId }
  if (readAt) filter.updatedAt = readAt
  const result = await Note.updateOne(
    filter,
    { $set: { ...(update ?? {}), embeddingStale: false } },
    { timestamps: false }
  ).exec()
  if (result.modifiedCount && update) upsertEmbedding(String(noteId), update.embedding)
  return result.modifiedCount > 0
}

// Re-embed every stale note, a batch at a time. A note that fails is
// tried once per pass, so an outage can't spin forever.
export async function refreshStaleEmbeddings({ batchSize = 50 } = {}) {
  const tried: unknown[] = []
  let embedded = 0, failed = 0
  for (;;) {
    const batch = await populated(Note.find({ ...STALE, _id: { $nin: tried } }).limit(batchSize))
    if (!batch.length) break
    for (const note of batch) {
      tried.push(note._id)
      try {
        const update = await embedNoteIfStale(note)
        if (await saveEmbedding(note._id, update, note.updatedAt) && update) embedded++
      } catch (e) {
        failed++
        console.error('[embed] error for note', note._id, e)
      }
    }
  }
  return { embedded, failed }
}

// Run a refresh soon, once, however many writes asked for it. Nothing
// happens without an OpenAI key, since nothing could be embedded.
let timer: ReturnType<typeof setTimeout> | null = null
let running: Promise<unknown> | null = null
let again = false

export function scheduleEmbeddingRefresh(delayMs = 2000) {
  if (!config.secrets.openaikey) return
  if (running) { again = true; return }
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    running = refreshStaleEmbeddings()
      .catch((e) => console.error('[embed] refresh failed', e))
      .finally(() => {
        running = null
        if (again) { again = false; scheduleEmbeddingRefresh(delayMs) }
      })
  }, delayMs)
}

// Notes whose stored embedding doesn't match their content (or that have
// none), found without calling OpenAI. Image-only notes without OCR text
// are left to the refresher, which reads their images.
export async function countOutdatedEmbeddings() {
  let outdated = 0
  const cursor = Note.find({}, { embedding: 0 })
    .populate('authors').populate('people').populate('ideas').populate('work')
    .lean().cursor()
  for await (const note of cursor as any) {
    const input = buildEmbeddingInput(note)
    if (input.trim() && note.embeddingHash !== hashContent(input)) outdated++
  }
  return outdated
}
