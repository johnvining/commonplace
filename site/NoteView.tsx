import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import { useParams } from 'react-router-dom'

function NoteView(props: any) {
  const { id, nick } = useParams()

  const getListOfOneNote = async () => {
    var notesResponse
    
    if (!id) {
      // Access by nick - use single request
      await db
        .getNoteByNick(nick)
        .then((response) => {
          notesResponse = response
        })
        .catch((error) => {
          console.error(error)
        })
    } else {
      // Access by ID - use existing method
      await db
        .getInfo(db.types.note, id)
        .then((response) => {
          notesResponse = response
        })
        .catch((error) => {
          console.error(error)
        })
    }

    const note = notesResponse?.data?.data?.[0]
    if (!note) return notesResponse

    if (note.title) {
      props.setPageTitle(note.title)
    } else if (note.text) {
      props.setPageTitle(note.text)
    } else {
      props.setPageTitle('Untitled Note')
    }

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
