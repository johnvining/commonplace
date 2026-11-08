// Values filled in from a URL (#377): a note's or work's year and authors
// from its own URL, and a work's URL from its notes'. One rule for the note
// and work editors and the importers alike:
//
//   inference only fills a field that is empty; a value already there, or
//   sent with the same request, is never replaced
//
// A filled-in value is then an ordinary value: it isn't revisited.
import mongoose from 'mongoose'
import { guessYearFromUrl } from './urls.js'

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

// Fill a note's or work's empty year and authors from the URL an update
// sets. A field counts as empty only if the update leaves it empty: an
// update without a year keeps the stored one. Mutates and returns `updates`.
export async function fillFromUrl(
  existing: { year?: unknown; authors?: unknown } | null,
  updates: Record<string, unknown>
) {
  const url = typeof updates.url === 'string' ? updates.url : null
  if (!url || !existing) return updates
  const after = (field: 'year' | 'authors') => (field in updates ? updates[field] : existing[field])

  if (isEmpty(after('year'))) {
    const year = guessYearFromUrl(url)
    if (year !== null) updates.year = year
  }
  // Authors only when the record had none and none are being set, so
  // removing every author isn't undone by the URL
  if (isEmpty(existing.authors) && isEmpty(updates.authors)) {
    const { findAuthorByUrl } = await import('../resources/auth/auth.controllers.js')
    const author = await findAuthorByUrl(url)
    if (author) updates.authors = [author._id]
  }
  return updates
}

// The year for a new imported record: the year cell if it holds one (an
// empty cell isn't 0, #349), else the URL's
export function yearForImport(year: unknown, url: string | undefined | null): number | null {
  const raw = typeof year === 'string' ? year.trim() : year
  if (!isEmpty(raw)) {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return url ? guessYearFromUrl(url) : null
}

// Give a work with no URL the site its notes are on: set only when every
// note has a URL and they all share one origin. Never replaces a URL.
export async function fillWorkUrl(workId: unknown) {
  if (!workId) return
  const Work = mongoose.model('work')
  const Note = mongoose.model('note')
  const work: any = await Work.findById(workId, { url: 1 }).lean()
  if (!work || !isEmpty(work.url)) return
  const notes: any[] = await Note.find({ work: workId }, { url: 1 }).lean()
  if (!notes.length || notes.some((n) => isEmpty(n.url))) return
  let origins: string[]
  try {
    origins = [...new Set(notes.map((n) => new URL(n.url).origin))]
  } catch {
    return
  }
  if (origins.length === 1) await Work.updateOne({ _id: work._id, $or: [{ url: { $exists: false } }, { url: null }, { url: '' }] }, { $set: { url: origins[0] } })
}
