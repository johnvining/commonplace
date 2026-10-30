import Note from '../resources/note/note.model.js'

// Count notes as seen: every time a note is loaded for the client (a list,
// a search, its own page, a flip deck) its seenCount goes up and seenAt
// moves to now. Call it after reading the notes, so the response still
// carries the previous seenAt. Doesn't touch updatedAt.
export async function markSeen(notes: Array<{ _id: unknown }>) {
  if (!notes.length) return
  await Note.updateMany(
    { _id: { $in: notes.map((note) => note._id) } },
    { $inc: { seenCount: 1 }, $set: { seenAt: new Date() } },
    { timestamps: false }
  ).exec()
}
