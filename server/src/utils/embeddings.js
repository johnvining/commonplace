import crypto from 'crypto'
import OpenAI from 'openai'
import config from '../config'
import { getOpenAiOCR } from './suggestions.js'

let _openai = null
const openai = () => {
  if (!_openai) _openai = new OpenAI({ apiKey: config.secrets.openaikey })
  return _openai
}

export function buildEmbeddingInput(note) {
  return [
    note.title,
    note.text,
    note.take,
    note.ocrText,
    note.author?.name,
    note.work?.name,
    note.ideas?.map(i => i.name).join(', '),
  ].filter(Boolean).join('. ')
}

export function hashContent(text) {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

const MAX_CHARS = 30000 // ~8k tokens at ~4 chars/token with headroom

export async function generateEmbedding(text) {
  const response = await openai().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, MAX_CHARS),
    dimensions: 256,
  })
  return response.data[0].embedding
}

export async function generateBatchEmbeddings(texts) {
  const response = await openai().embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    dimensions: 256,
  })
  return response.data.map(d => d.embedding)
}

// Runs OCR on all images and concatenates. Returns null if not applicable.
export async function generateOcrTextIfNeeded(note) {
  if (note.text || !note.images?.length) return null
  const results = await Promise.all(
    note.images.map(img =>
      getOpenAiOCR(config.imageStorePath + '/' + img).catch(() => '')
    )
  )
  return results.filter(Boolean).join('\n\n') || null
}

// Returns { embedding, embeddingHash, ocrText } if the note needs updating,
// or null if the stored hash already matches (idempotent).
export async function embedNoteIfStale(note) {
  let ocrText = note.ocrText ?? null
  if (!note.text && note.images?.length && !ocrText) {
    ocrText = await generateOcrTextIfNeeded(note)
  }

  const input = buildEmbeddingInput({ ...note, ocrText })
  if (!input.trim()) return null

  const hash = hashContent(input)
  if (note.embeddingHash === hash) return null

  const embedding = await generateEmbedding(input)
  const result = { embedding, embeddingHash: hash }
  if (ocrText && ocrText !== note.ocrText) result.ocrText = ocrText
  return result
}
