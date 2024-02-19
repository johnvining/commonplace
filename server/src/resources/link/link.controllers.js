import Link from '../link/link.model.js'
import Nick from '../nick/nick.model.js'

export const reqLinkNoteToNote = async (req, res, type) => {
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
