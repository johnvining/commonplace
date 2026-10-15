import * as constants from './constants'
import * as db from './Database'
import { notePageTitle } from './utils'
import NoteList from './NoteList'
import { useParams } from 'react-router-dom'

function NoteView(props: any) {
  const { id = '', nick } = useParams()

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
    if (!note) return notesResponse

    props.setPageTitle(notePageTitle(note))

    return notesResponse
  }

  return (
    <NoteList
      key={'note' + (id ?? nick)}
      viewMode={constants.view_modes.FULL}
      editFirst={props.edit}
      getListOfNotes={getListOfOneNote}
      fromNoteView={true}
      setPageTitle={props.setPageTitle}
    />
  )
}

export default NoteView
