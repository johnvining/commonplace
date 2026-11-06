import Note from '../resources/note/note.model.js'
import config from '../config'
import { getOpenAiOCR } from './suggestions.js'
import { ocrMayWrite, setOcrText, textSourceOf } from './noteText.js'

const ocrImage = async (img: string) =>
  ((await getOpenAiOCR(config.imageStorePath + '/' + img)) ?? '').trim()

export function isOcrConfigured() {
  return Boolean(config.secrets.openaikey)
}

// Fill a note's text from its images (#331). Every OCR path (upload,
// backlog, bulk OCR) comes through here.
//
// Only touches text that is blank or OCR's own (#379); anything the user
// typed or edited is left alone. `newImages` are images added since the
// last OCR: their text is appended. When there's no earlier OCR to build
// on, every image is read.
//
// Returns the updated note, or null if nothing changed.
export async function autoOcrNote(noteId: unknown, newImages: string[] = []) {
  const note = await Note.findById(noteId).lean()
  if (!note?.images?.length || !ocrMayWrite(note)) return null

  const text = note.text ?? ''
  // OCR text already covering the note's other images, if any. The
  // embedding job also fills ocrText for image-only notes.
  const prior = textSourceOf(note) === 'ocr' ? text : (note.ocrText ?? '').trim()
  const toRead = prior ? newImages.filter((img) => note.images.includes(img)) : note.images
  const fresh = await Promise.all(toRead.map(ocrImage))

  const combined = [prior, ...fresh].filter((t) => t.trim()).join('\n\n').trim()
  if (!combined || combined === text) return null
  return setOcrText(Note, note, combined)
}
