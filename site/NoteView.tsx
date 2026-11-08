import * as constants from './constants'
import * as db from './Database'
import { notePageTitle } from './utils'
import NoteList from './NoteList'
import Missing, { whatBecameOf } from './Missing'
import { noteStatus } from './noteStatus'
import React from 'react'
import { useParams } from 'react-router-dom'

function NoteView(props: any) {
  const { id = '', nick } = useParams()
  // As loaded, so "opened" is the visit before this one.
  const [note, setNote] = React.useState<any>(null)
  // Set when the note doesn't exist (#388)
  const [missing, setMissing] = React.useState<{ name?: string | null } | null>(null)
  React.useEffect(() => setMissing(null), [id, nick])

  const getListOfOneNote = async () => {
    let notesResponse: any

    if (!id) {
      // Access by nick - use single request
      if (!nick) return null
      await db
        .getNoteByNick(nick)
        .then((response: any) => {
          notesResponse = response
        })
        .catch((error: any) => {
          console.error(error)
        })
    } else {
      // Access by ID - use existing method
      await db
        .getInfo(db.types.note, id)
        .then((response: any) => {
          notesResponse = response
        })
        .catch((error: any) => {
          console.error(error)
        })
    }

    const note = notesResponse?.data?.data?.[0]
    if (!note) {
      // Loaded, but no such note: say so, naming a deleted one (#388)
      if (notesResponse) {
        const { name } = id ? await whatBecameOf('note', id) : { name: null }
        setMissing({ name })
      }
      return notesResponse
    }
    setNote(note)

    // NoteList loads this once per page visit, so this counts one open.
    db.recordOpened(db.types.note, note._id)

    props.setPageTitle(notePageTitle(note))

    return notesResponse
  }

  if (missing) {
    props.setPageTitle('Note does not exist')
    return <Missing type="note" name={missing.name} />
  }

  return (
    <>
      {note && <p className="note-status">{noteStatus(note)}</p>}
      <NoteList
        key={'note' + (id ?? nick)}
        viewMode={constants.view_modes.FULL}
        editFirst={props.edit}
        getListOfNotes={getListOfOneNote}
        fromNoteView={true}
        setPageTitle={props.setPageTitle}
      />
    </>
  )
}

export default NoteView
