import Link from '../link/link.model.js'
import Nick from '../nick/nick.model.js'
import Note from '../note/note.model.js'
import { isValidObjectId } from 'mongoose'
import type { Request, Response } from 'express'


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
    const [leftNick, rightNick] = await Promise.all([
      Nick.findOne({ key: leftNoteNick }),
      Nick.findOne({ key: rightNoteNick }),
    ])
    if (!leftNick?.note) return res.status(400).json({ message: 'Left note nick not found' })
    if (!rightNick?.note) return res.status(400).json({ message: 'Right note nick not found' })
    leftNoteId = leftNick.note
    rightNoteId = rightNick.note
  } else {
    return res.status(400).json({ message: 'Provide fromId and toId note IDs' })
  }

  const existing_link = await Link.findOne({
    left_note: leftNoteId,
    right_note: rightNoteId,
  })
  const existing_link_inverse = await Link.findOne({
    left_note: rightNoteId,
    right_note: leftNoteId,
  })

  if (existing_link || existing_link_inverse) {
    return existing_link ?? existing_link_inverse
  }

  const new_link = await Link.create({
    left_note: leftNoteId,
    right_note: rightNoteId,
  })

  return new_link
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

  const [notes, nicks] = await Promise.all([
    // Most recently updated first, with _id as a tiebreak, so the order is
    // stable between renders (#325).
    Note.find({ _id: { $in: linkedIds } }).sort({ updatedAt: -1, _id: -1 }).lean().exec(),
    Nick.find({ note: { $in: linkedIds } }).lean().exec(),
  ])

  const nickMap = Object.fromEntries(nicks.map((n: any) => [String(n.note), n.key]))
  notes.forEach((n: any) => { n.nick = nickMap[String(n._id)] || null })
  return notes
}
