import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import { useParams } from 'react-router-dom'

function NoteView(props) {
  const { id } = useParams()

  const getListOfOneNote = async () => {
    var notesResponse
    var noteId
    if (!id) {
      const nick = await db.getNick(this.props.nick)
      noteId = nick.data.data.note
    } else {
      noteId = id
    }

    await db
      .getInfo(db.types.note, noteId)
      .then((response) => {
        notesResponse = response
      })
      .catch((error) => {
        console.error(error)
      })
    if (notesResponse.data.data[0].title) {
      props.setPageTitle(notesResponse.data.data[0].title)
    } else if (notesResponse.data.data[0].text) {
      props.setPageTitle(notesResponse.data.data[0].text)
    } else {
      props.setPageTitle('Untitled Note')
    }

    return notesResponse
  }

  return (
    <NoteList
      key={'note' + (id ?? this.props.nick)}
      viewMode={constants.view_modes.FULL}
      editFirst={props.edit}
      getListOfNotes={getListOfOneNote}
    />
  )
}

export default NoteView
