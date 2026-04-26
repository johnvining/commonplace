import Note from '../resources/note/note.model.js'

// In-memory cache: Map<noteId string, Float32Array | number[]>
let cache = null
let loadPromise = null

async function loadAll() {
  const docs = await Note.find(
    { embedding: { $exists: true, $ne: [] } },
    { embedding: 1, _id: 1 }
  ).lean().exec()
  const map = new Map()
  for (const doc of docs) {
    map.set(String(doc._id), doc.embedding)
  }
  return map
}

export async function getEmbeddingCache() {
  if (cache) return cache
  if (!loadPromise) loadPromise = loadAll().then(m => { cache = m; loadPromise = null; return m })
  return loadPromise
}

export function invalidateEmbedding(noteId) {
  cache?.delete(String(noteId))
}

export function upsertEmbedding(noteId, embedding) {
  if (cache) cache.set(String(noteId), embedding)
}
