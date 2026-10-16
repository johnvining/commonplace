import Note from '../resources/note/note.model.js'

// Add note_count (the number of notes on each work) to a list of works,
// in one aggregate rather than a count per work.
export async function withNoteCounts<T extends { _id: unknown }>(works: T[]) {
  if (!works.length) return works.map((w) => ({ ...w, note_count: 0 }))
  const counts = await Note.aggregate([
    { $match: { work: { $in: works.map((w) => w._id) } } },
    { $group: { _id: '$work', count: { $sum: 1 } } },
  ])
  const byWork = Object.fromEntries(counts.map((c) => [String(c._id), c.count]))
  return works.map((w) => ({ ...w, note_count: byWork[String(w._id)] || 0 }))
}
