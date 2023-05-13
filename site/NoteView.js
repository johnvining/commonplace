import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'

class NoteView extends React.Component {
  state = {
    id: ''
  }

  async getListOfOneNote(index, page) {
    var notesResponse
    var noteId
    if (!this.props.id) {
      const nick = await db.getNick(this.props.nick)
      console.log(nick)
      noteId = nick.data.data.note
    } else {
      noteId = this.props.id
    }

    await db
      .getInfo(db.types.note, noteId)
      .then(response => {
        notesResponse = response
      })
      .catch(error => {
        console.error(error)
      })
    if (notesResponse.data.data[0].title) {
      this.props.setPageTitle(notesResponse.data.data[0].title)
    } else if (notesResponse.data.data[0].text) {
      this.props.setPageTitle(notesResponse.data.data[0].text)
    } else {
      this.props.setPageTitle('Untitled Note')
    }

    return notesResponse
  }

  render() {
    return (
      <NoteList
        key={'note' + (this.props.id ?? this.props.nick)}
        viewMode={constants.view_modes.FULL}
        editFirst={this.props.edit}
        getListOfNotes={this.getListOfOneNote.bind(this)}
      />
    )
  }
}

export default NoteView
