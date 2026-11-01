// Read-only queries behind dedup and relink passes (#357), so the
// analysis lives in the API and CLI instead of direct database reads.
import Note from '../resources/note/note.model.js'
import Work from '../resources/work/work.model.js'
import { Auth } from '../resources/auth/auth.model.js'

// Key for spotting near-duplicate names: case, accents, punctuation and
// spacing don't count, so "race ? »,par" and "race ? », par" match.
export function nameKey(name: string | null | undefined): string {
  return (name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

const titleKey = (title: string | null | undefined) => (title ?? '').trim().toLowerCase()

interface NoteRow {
  _id: unknown
  title?: string
  work?: unknown
}

// Notes grouped by title (ignoring case and outer spaces), largest first,
// keeping groups of at least `minCount`. Untitled notes are left out.
export async function noteTitleGroups(minCount = 2) {
  const notes: NoteRow[] = await Note.find({ title: { $nin: [null, ''] } }, { title: 1, work: 1 }).lean().exec()
  const groups = new Map<string, NoteRow[]>()
  for (const note of notes) {
    const key = titleKey(note.title)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(note)
  }
  return [...groups.values()]
    .filter((group) => group.length >= Math.max(1, minCount))
    .sort((a, b) => b.length - a.length || titleKey(a[0].title).localeCompare(titleKey(b[0].title)))
    .map((group) => ({
      title: group[0].title?.trim(),
      count: group.length,
      unlinked: group.filter((n) => !n.work).length,
      ids: group.map((n) => n._id),
    }))
}

// Notes whose title is exactly a work's name (ignoring case and outer
// spaces) but which aren't linked to that work, grouped by work.
export async function notesTitledLikeAWork() {
  const works = await Work.find({}, { name: 1 }).lean().exec()
  const byTitle = new Map<string, { _id: unknown; name?: string }[]>()
  for (const work of works) {
    const key = titleKey(work.name)
    if (!key) continue
    if (!byTitle.has(key)) byTitle.set(key, [])
    byTitle.get(key)!.push(work)
  }
  const notes: NoteRow[] = await Note.find({ title: { $nin: [null, ''] } }, { title: 1, work: 1 }).lean().exec()
  const out = new Map<string, { work: { _id: unknown; name?: string }; notes: NoteRow[] }>()
  for (const note of notes) {
    const matches = byTitle.get(titleKey(note.title))
    // A note already on one of the same-named works is fine
    if (!matches || matches.some((w) => String(w._id) === String(note.work))) continue
    const work = matches[0]
    const key = String(work._id)
    if (!out.has(key)) out.set(key, { work: { _id: work._id, name: work.name }, notes: [] })
    out.get(key)!.notes.push({ _id: note._id, title: note.title, work: note.work ?? null })
  }
  return [...out.values()].sort((a, b) => b.notes.length - a.notes.length)
}

export async function worksWithoutNotes() {
  const used = await Note.distinct('work', { work: { $ne: null } })
  return Work.find({ _id: { $nin: used } }).populate('authors').sort({ name: 1 }).lean().exec()
}

// Groups of records whose names share a nameKey, largest first
async function duplicateNames(Model: any, populate?: string) {
  let query = Model.find({}, { name: 1, authors: 1 })
  if (populate) query = query.populate(populate, 'name')
  const docs = await query.lean().exec()
  const groups = new Map<string, any[]>()
  for (const doc of docs) {
    const key = nameKey(doc.name)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(doc)
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .sort((a, b) => b.length - a.length || String(a[0].name).localeCompare(String(b[0].name)))
}

export const duplicateWorks = () => duplicateNames(Work, 'authors')
export const duplicateAuthors = () => duplicateNames(Auth)

// Authors whose name looks like several people in one record ("A, B",
// "A & B", "A and B", "A; B"), candidates for `auth split`.
const COMBINED = /,|;|\s&\s|\sand\s/i
export async function combinedAuthors() {
  const authors = await Auth.find({ name: COMBINED }, { name: 1 }).sort({ name: 1 }).lean().exec()
  return authors
}
