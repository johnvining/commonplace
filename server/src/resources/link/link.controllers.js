import Link from '../link/link.model.js'
import Nick from '../nick/nick.model.js'
import Note from '../note/note.model.js'

export const reqLinkNoteToNote = async (req, res) => {
  const leftNoteNick = await Nick.findOne({ key: req.body.leftNoteNick })
  const rightNoteNick = await Nick.findOne({
    key: req.body.rightNoteNick,
  })
  const leftNoteId = leftNoteNick.note
  const rightNoteId = rightNoteNick.note

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

export const reqGetLinksForNote = async (req, res) => {
  const noteId = req.params.id
  const [fromLeft, fromRight] = await Promise.all([
    Link.find({ left_note: noteId }),
    Link.find({ right_note: noteId }),
  ])
  const linkedIds = fromLeft.concat(fromRight)
    .flatMap(r => [r.left_note, r.right_note])
    .filter(id => String(id) !== String(noteId))

  const [notes, nicks] = await Promise.all([
    Note.find({ _id: { $in: linkedIds } }).lean().exec(),
    Nick.find({ note: { $in: linkedIds } }).lean().exec(),
  ])

  const nickMap = Object.fromEntries(nicks.map(n => [String(n.note), n.key]))
  notes.forEach(n => { n.nick = nickMap[String(n._id)] || null })
  return notes
}
