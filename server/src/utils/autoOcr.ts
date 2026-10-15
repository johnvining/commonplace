import Note from '../resources/note/note.model.js'
import config from '../config'
import { getOpenAiOCR } from './suggestions.js'

const ocrImage = async (img: string) =>
  ((await getOpenAiOCR(config.imageStorePath + '/' + img)) ?? '').trim()

export function isOcrConfigured() {
  return Boolean(config.secrets.openaikey)
}

// Fill a note's text from its images (#331).
//
// Only touches text that is blank or still exactly what a previous OCR
// wrote (text === ocrText); anything the user typed or edited is left
// alone. `newImages` are images added since that OCR ran: their text is
// appended. When there's no earlier OCR to build on, every image is read.
//
// Returns the updated note, or null if nothing changed.
export async function autoOcrNote(noteId: unknown, newImages: string[] = []) {
  const note = await Note.findById(noteId).lean()
  if (!note?.images?.length) return null

  const text = note.text ?? ''
  const isAutoText = text.trim() === '' || text === note.ocrText
  if (!isAutoText) return null

  // OCR text already covering the note's other images, if any. The
  // embedding job also fills ocrText for image-only notes.
  const prior = text.trim() ? text : (note.ocrText ?? '').trim()
  const toRead = prior ? newImages.filter((img) => note.images.includes(img)) : note.images
  const fresh = await Promise.all(toRead.map(ocrImage))

  const combined = [prior, ...fresh].filter((t) => t.trim()).join('\n\n').trim()
  if (!combined || combined === text) return null

  // Write only if the text hasn't changed while OCR ran ({ text: null }
  // also matches a missing field).
  return Note.findOneAndUpdate(
    { _id: note._id, text: note.text ?? null },
    { $set: { text: combined, ocrText: combined } },
    { new: true }
  )
    .lean()
    .exec()
}
