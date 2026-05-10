import Note from '../resources/note/note.model.js'

type Embedding = number[]
type Cache = Map<string, Embedding>

let cache: Cache | null = null
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

export async function getEmbeddingCache(): Promise<Cache> {
  if (cache) return cache
  if (!loadPromise) {
    loadPromise = loadAll().then((m) => {
      cache = m
      loadPromise = null
      return m
    })
  }
  return loadPromise
}

export function invalidateEmbedding(noteId: string): void {
  cache?.delete(String(noteId))
}

export function upsertEmbedding(noteId: string, embedding: Embedding): void {
  if (cache) cache.set(String(noteId), embedding)
}
