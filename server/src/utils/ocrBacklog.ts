import Note from '../resources/note/note.model.js'
import { autoOcrNote, isOcrConfigured } from './autoOcr.js'
import { embedNoteIfStale } from './embeddings.js'

const BLANK_IMAGE_NOTES = {
  'images.0': { $exists: true },
  $or: [{ text: { $exists: false } }, { text: null }, { text: /^\s*$/ }],
}

// Fill in the text of image notes that have none, from their images (#305).
// Same rules as OCR on upload: notes with text are never touched. Newest
// first; `limit` of 0 means all.
export async function runOcrBacklog({
  dryRun,
  limit = 0,
  log,
}: {
  dryRun: boolean
  limit?: number
  log: (line: string) => void
}) {
  if (!dryRun && !isOcrConfigured()) {
    throw new Error('No OpenAI key configured (OPENAI_API_KEY)')
  }

  const total = await Note.countDocuments(BLANK_IMAGE_NOTES)
  const notes = await Note.find(BLANK_IMAGE_NOTES, { images: 1, ocrText: 1 })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
  // Notes whose images were already read for search only need copying.
  const cached = notes.filter((n) => n.ocrText?.trim()).length
  const imagesToRead = notes
    .filter((n) => !n.ocrText?.trim())
    .reduce((sum, n) => sum + n.images.length, 0)
  log(
    `${total} image notes without text; ${dryRun ? 'would process' : 'processing'} ${notes.length} ` +
      `(${cached} from stored OCR, ${imagesToRead} images to read)`
  )
  if (dryRun) return { filled: 0, failed: 0 }

  let filled = 0
  let failed = 0
  for (const [i, { _id }] of notes.entries()) {
    const label = `[${i + 1}/${notes.length}] ${_id}`
    try {
      const updated = await autoOcrNote(_id)
      if (!updated) {
        log(`${label} skipped (text changed or no text found)`)
        continue
      }
      // Keep search in step with the new text.
      const embedding = await embedNoteIfStale(updated)
      if (embedding) await Note.findByIdAndUpdate(_id, embedding)
      filled++
      log(`${label} filled (${updated.text?.length ?? 0} chars)`)
    } catch (e) {
      failed++
      log(`${label} failed: ${e instanceof Error ? e.message : e}`)
    }
  }
  log(`Done: ${filled} filled, ${failed} failed`)
  return { filled, failed }
}
