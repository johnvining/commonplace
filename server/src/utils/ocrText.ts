// OCR of an image with no text (a photo, a painting) used to come back as
// an apology — "Sorry, I can't transcribe the text from this image." —
// which then became the note's text. The prompt now asks for NO_TEXT in
// that case; this turns NO_TEXT, and any apology that slips through, into
// an empty string, so callers treat the image as having no text.
export const NO_TEXT = 'NO_TEXT'

const REFUSAL =
  /^(?:i['’]?m sorry|sorry|i (?:can(?:no|['’])?t|am unable|cannot|could(?:n['’]t| not))|unable to|there (?:is|are|appears to be) no (?:visible |legible |readable )?text|no (?:visible |legible |readable )?text)/i

export function cleanOcrText(raw: string | null | undefined): string {
  const text = (raw ?? '').trim()
  if (!text) return ''
  if (text.length < 40 && text.toUpperCase().includes(NO_TEXT)) return ''
  // Real transcriptions can start with "Sorry", so only short replies
  // that are about the text/transcribing count as refusals.
  if (text.length < 300 && REFUSAL.test(text) && /transcri|text/i.test(text)) return ''
  return text
}
