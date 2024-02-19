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
  const findFromLeft = await Link.find({ left_note: noteId })
  const findFromRight = await Link.find({ right_note: noteId })
  let combinedResults = findFromLeft.concat(findFromRight)
  combinedResults = combinedResults
    .map((result) => [result.left_note, result.right_note])
    .flat()
    .filter((result) => result != noteId)

  let resultsToReturn = await Note.find({ _id: { $in: combinedResults } })
  return resultsToReturn
}
