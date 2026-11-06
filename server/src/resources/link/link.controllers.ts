import Link from '../link/link.model.js'
import { nickKeysFor, resolveNick } from '../nick/nickLifecycle.js'
import Note from '../note/note.model.js'
import { isValidObjectId } from 'mongoose'
import type { Request, Response } from 'express'

// A link joins two notes with no direction. It's stored with the smaller
// id on the left, so each pair has one canonical row (#371).
export function canonicalPair(a: unknown, b: unknown): [string, string] {
  const [x, y] = [String(a), String(b)]
  return x < y ? [x, y] : [y, x]
}

// Create the link between two notes, or return the one already there.
// The upsert and the unique index make this safe to race.
export async function linkNotes(a: unknown, b: unknown) {
  const [left, right] = canonicalPair(a, b)
  if (left === right) throw Object.assign(new Error('A note cannot link to itself'), { status: 400 })
  const filter = { left_note: left, right_note: right }
  try {
    return await Link.findOneAndUpdate(filter, { $setOnInsert: filter }, { upsert: true, new: true }).exec()
  } catch (e: any) {
    if (e?.code === 11000) return Link.findOne(filter).exec()
    throw e
  }
}

// Remove every link touching a note, for its delete cascade
export const unlinkAllFor = (noteId: unknown) =>
  Link.deleteMany({ $or: [{ left_note: noteId }, { right_note: noteId }] }).exec()

export const reqLinkNoteToNote = async (req: Request, res: Response) => {
  const { fromId, toId, leftNoteNick, rightNoteNick } = req.body ?? {}
  let leftNoteId
  let rightNoteId

  if (fromId !== undefined || toId !== undefined) {
    if (typeof fromId !== 'string' || !isValidObjectId(fromId)) {
      return res.status(400).json({ message: 'Invalid fromId' })
    }
    if (typeof toId !== 'string' || !isValidObjectId(toId)) {
      return res.status(400).json({ message: 'Invalid toId' })
    }

    const [leftNote, rightNote] = await Promise.all([
      Note.findById(fromId).select('_id').lean().exec(),
      Note.findById(toId).select('_id').lean().exec(),
    ])
    if (!leftNote) return res.status(400).json({ message: 'Note not found for fromId' })
    if (!rightNote) return res.status(400).json({ message: 'Note not found for toId' })
    leftNoteId = leftNote._id
    rightNoteId = rightNote._id
  } else if (typeof leftNoteNick === 'string' && typeof rightNoteNick === 'string') {
    const [left, right] = await Promise.all([resolveNick(leftNoteNick), resolveNick(rightNoteNick)])
    const noteId = (found: Awaited<ReturnType<typeof resolveNick>>) =>
      found && found.state !== 'retired' && found.type === 'note' ? found.id : null
    leftNoteId = noteId(left)
    rightNoteId = noteId(right)
    if (!leftNoteId) return res.status(400).json({ message: 'Left note nick not found' })
    if (!rightNoteId) return res.status(400).json({ message: 'Right note nick not found' })
  } else {
    return res.status(400).json({ message: 'Provide fromId and toId note IDs' })
  }

  return linkNotes(leftNoteId, rightNoteId)
}

// DELETE /link/:id
export const reqDeleteLink = async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid link id' })
  const { deletedCount } = await Link.deleteOne({ _id: req.params.id }).exec()
  if (!deletedCount) return res.status(404).json({ message: 'Link not found' })
  return null
}

// DELETE /link/between/:a/:b, in either order
export const reqDeleteLinkBetween = async (req: Request, res: Response) => {
  const { a, b } = req.params
  if (!isValidObjectId(a) || !isValidObjectId(b)) return res.status(400).json({ message: 'Invalid note id' })
  const [left, right] = canonicalPair(a, b)
  // Also catches a reversed row left from before links were canonical
  const { deletedCount } = await Link.deleteMany({
    $or: [{ left_note: left, right_note: right }, { left_note: right, right_note: left }],
  }).exec()
  if (!deletedCount) return res.status(404).json({ message: 'Link not found' })
  return null
}

export const reqGetLinksForNote = async (req: Request, res: Response) => {
  const noteId = req.params.id
  const [fromLeft, fromRight] = await Promise.all([
    Link.find({ left_note: noteId }),
    Link.find({ right_note: noteId }),
  ])
  const linkedIds = fromLeft.concat(fromRight)
    .flatMap(r => [r.left_note, r.right_note])
    .filter(id => String(id) !== String(noteId))

  const [notes, keys] = await Promise.all([
    // Most recently updated first, with _id as a tiebreak, so the order is
    // stable between renders (#325).
    Note.find({ _id: { $in: linkedIds } }).sort({ updatedAt: -1, _id: -1 }).lean().exec(),
    nickKeysFor('note', linkedIds),
  ])
  notes.forEach((n: any) => { n.nick = keys.get(String(n._id)) ?? null })
  return notes
}
