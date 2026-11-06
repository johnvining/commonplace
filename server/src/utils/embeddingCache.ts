import Note from '../resources/note/note.model.js'

type Embedding = number[]
type Cache = Map<string, Embedding>

// A view of the embeddings in Mongo for semantic search (#373). This
// process keeps it current through saveEmbedding and note deletes; it
// also reloads every RELOAD_MS, in the background, to pick up writes from
// other processes (the CLI, maintenance scripts).
const RELOAD_MS = 10 * 60 * 1000

let cache: Cache | null = null
let loadedAt = 0
let loadPromise: Promise<Cache> | null = null

async function loadAll(): Promise<Cache> {
  const docs = await Note.find(
    { embedding: { $exists: true, $ne: [] } },
    { embedding: 1, _id: 1 }
  ).lean().exec()
  const map: Cache = new Map()
  for (const doc of docs) {
    map.set(String(doc._id), doc.embedding as Embedding)
  }
  return map
}

function reload(): Promise<Cache> {
  if (!loadPromise) {
    loadPromise = loadAll()
      .then((m) => {
        cache = m
        loadedAt = Date.now()
        return m
      })
      .finally(() => { loadPromise = null })
  }
  return loadPromise
}

export async function getEmbeddingCache(): Promise<Cache> {
  if (!cache) return reload()
  if (Date.now() - loadedAt > RELOAD_MS) {
    reload().catch((e) => console.error('[embed] cache reload failed', e))
  }
  return cache
}

export function invalidateEmbedding(noteId: string): void {
  cache?.delete(String(noteId))
}

export function upsertEmbedding(noteId: string, embedding: Embedding): void {
  if (cache) cache.set(String(noteId), embedding)
}
