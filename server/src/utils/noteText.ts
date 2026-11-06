// Where a note's text came from, and so whether OCR may rewrite it (#379).
//
//   blank  no text yet
//   ocr    the text is what OCR read from the note's images
//   user   the text was typed, pasted or imported
//
// OCR may write only over blank or OCR text, and only through setOcrText,
// which updates text, ocrText and textSource together. Every other write
// of `text` is recorded as the user's by the note model's hooks (see
// trackTextSource), so no writer can leave the flag stale.
import type { Schema } from 'mongoose'

export type TextSource = 'blank' | 'ocr' | 'user'
export const TEXT_SOURCES: TextSource[] = ['blank', 'ocr', 'user']

interface NoteTextFields {
  text?: string | null
  ocrText?: string | null
  textSource?: string | null
}

// The one place a note's text source is read. Notes saved before the
// field existed fall back to the old rule: OCR's text if it still equals
// the stored OCR copy.
export function textSourceOf(note: NoteTextFields): TextSource {
  if (TEXT_SOURCES.includes(note.textSource as TextSource)) return note.textSource as TextSource
  const text = note.text ?? ''
  if (!text.trim()) return 'blank'
  return text === note.ocrText ? 'ocr' : 'user'
}

export const sourceForTypedText = (text: unknown): TextSource =>
  typeof text === 'string' && text.trim() ? 'user' : 'blank'

export const ocrMayWrite = (note: NoteTextFields) => textSourceOf(note) !== 'user'

// The one way OCR sets a note's text. Writes only if the text hasn't
// changed since `note` was read ({ text: null } also matches a missing
// field), and returns the updated note, or null if it lost that race.
export async function setOcrText(
  Note: any,
  note: { _id: unknown; text?: string | null },
  text: string
) {
  return Note.findOneAndUpdate(
    { _id: note._id, text: note.text ?? null },
    { $set: { text, ocrText: text, textSource: 'ocr' } },
    { new: true }
  )
    .lean()
    .exec()
}

// Record a write of `text` that doesn't say where it came from as the
// user's, on saves and on every kind of update. The editor sends the text
// back on every save, so a single-note write that leaves the text as it
// was keeps its source: fixing an OCR note's title mustn't stop later
// uploads adding their text.
export function trackTextSource(schema: Schema) {
  schema.pre('save', function () {
    if (this.isModified('text') && !this.isModified('textSource')) {
      this.set('textSource', sourceForTypedText(this.get('text')))
    }
  })
  for (const op of ['findOneAndUpdate', 'updateOne', 'updateMany'] as const) {
    schema.pre(op, async function () {
      const update: any = this.getUpdate()
      if (!update || Array.isArray(update)) return
      const $set = update.$set ?? {}
      const setsSource = 'textSource' in update || 'textSource' in $set
      if (setsSource) return
      const target = 'text' in update ? update : 'text' in $set ? $set : null
      if (target) {
        if (op !== 'updateMany') {
          const current: any = await this.model.findOne(this.getQuery(), { text: 1 }).lean()
          if (current && (current.text ?? '') === (target.text ?? '')) return
        }
        target.textSource = sourceForTypedText(target.text)
      } else if (update.$unset && 'text' in update.$unset) update.$set = { ...$set, textSource: 'blank' }
    })
  }
}
