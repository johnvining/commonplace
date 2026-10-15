import Note from '../resources/note/note.model.js'
import { autoOcrNote, isOcrConfigured } from '../utils/autoOcr'
import { embedNoteIfStale } from '../utils/embeddings'
import { runCli } from './run'

// Fill in the text of image notes that have none, from their images (#305).
// Uses the same rules as OCR on upload: notes with text are never touched.
//
//   npm run ocr-backlog -- --dry-run      # count, no OpenAI calls
//   npm run ocr-backlog -- --limit 20     # newest 20 first
//   npm run ocr-backlog
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 0
if (limitArg >= 0 && !(limit > 0)) {
  console.error('Usage: npm run ocr-backlog -- [--dry-run] [--limit N]')
  process.exit(1)
}

const BLANK_IMAGE_NOTES = {
  'images.0': { $exists: true },
  $or: [{ text: { $exists: false } }, { text: null }, { text: /^\s*$/ }],
}

runCli(async () => {
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
  console.log(
    `${total} image notes without text; processing ${notes.length} ` +
      `(${cached} from stored OCR, ${imagesToRead} images to read)`
  )
  if (dryRun) return

  let filled = 0
  let failed = 0
  for (const [i, { _id }] of notes.entries()) {
    const label = `[${i + 1}/${notes.length}] ${_id}`
    try {
      const updated = await autoOcrNote(_id)
      if (!updated) {
        console.log(`${label} skipped (text changed or no text found)`)
        continue
      }
      // Keep search in step with the new text.
      const embedding = await embedNoteIfStale(updated)
      if (embedding) await Note.findByIdAndUpdate(_id, embedding)
      filled++
      console.log(`${label} filled (${updated.text?.length ?? 0} chars)`)
    } catch (e) {
      failed++
      console.error(`${label} failed:`, e instanceof Error ? e.message : e)
    }
  }
  console.log(`Done: ${filled} filled, ${failed} failed`)
  if (failed) process.exitCode = 1
})
