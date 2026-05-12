import crypto from 'crypto'
import OpenAI from 'openai'
import config from '../config'
import { getOpenAiOCR } from './suggestions.js'

type EmbeddingVector = number[]

// Callers pass populated/lean Mongoose docs whose shape varies — author/work
// may be ObjectIds or populated objects. This shape covers what we read.
interface NoteForEmbedding {
  title?: string | null
  text?: string | null
  take?: string | null
  ocrText?: string | null
  author?: { name?: string | null } | unknown
  work?: { name?: string | null } | unknown
  ideas?: Array<{ name?: string | null } | unknown>
  images?: string[]
  embeddingHash?: string | null
}

function maybeName(x: unknown): string | undefined {
  if (x && typeof x === 'object' && 'name' in x) {
    const n = (x as { name?: unknown }).name
    if (typeof n === 'string') return n
  }
  return undefined
}

interface EmbeddingUpdate {
  embedding: EmbeddingVector
  embeddingHash: string
  ocrText?: string
}

let _openai: OpenAI | null = null
const openai = (): OpenAI => {
  if (!_openai) {
    // See suggestions.ts: cap timeout at 60s, retry up to 3x for
    // transient rate-limit / 5xx so a single hiccup doesnt fail the
    // whole bulk-embed pass.
    _openai = new OpenAI({
      apiKey: config.secrets.openaikey,
      timeout: 60_000,
      maxRetries: 3,
    })
  }
  return _openai
}

export function buildEmbeddingInput(note: NoteForEmbedding): string {
  return [
    note.title,
    note.text,
    note.take,
    note.ocrText,
    maybeName(note.author),
    maybeName(note.work),
    note.ideas?.map((i) => maybeName(i)).filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join('. ')
}

export function hashContent(text: string): string {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]/g, '')
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  let dot = 0,
    normA = 0,
    normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

const MAX_CHARS = 20000 // conservative limit; dense content (code, CJK) tokenizes at fewer chars/token

export async function generateEmbedding(text: string): Promise<EmbeddingVector> {
  const response = await openai().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, MAX_CHARS),
    dimensions: 256,
  })
  return response.data[0].embedding
}

export async function generateBatchEmbeddings(
  texts: string[]
): Promise<EmbeddingVector[]> {
  const response = await openai().embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    dimensions: 256,
  })
  return response.data.map((d) => d.embedding)
}

// Runs OCR on all images and concatenates. Returns null if not applicable.
export async function generateOcrTextIfNeeded(
  note: NoteForEmbedding
): Promise<string | null> {
  if (note.text || !note.images?.length) return null
  const results = await Promise.all(
    note.images.map((img: string) =>
      getOpenAiOCR(config.imageStorePath + '/' + img).catch(() => '')
    )
  )
  return results.filter(Boolean).join('\n\n') || null
}

// Returns { embedding, embeddingHash, ocrText } if the note needs updating,
// or null if the stored hash already matches (idempotent).
export async function embedNoteIfStale(
  note: NoteForEmbedding
): Promise<EmbeddingUpdate | null> {
  let ocrText: string | null = note.ocrText ?? null
  if (!note.text && note.images?.length && !ocrText) {
    ocrText = await generateOcrTextIfNeeded(note)
  }

  const input = buildEmbeddingInput({ ...note, ocrText })
  if (!input.trim()) return null

  const hash = hashContent(input)
  if (note.embeddingHash === hash) return null

  const embedding = await generateEmbedding(input)
  const result: EmbeddingUpdate = { embedding, embeddingHash: hash }
  if (ocrText && ocrText !== note.ocrText) result.ocrText = ocrText
  return result
}
