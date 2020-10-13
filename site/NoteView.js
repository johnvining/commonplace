import React from 'react'
import NoteList from './NoteList'
import { getNoteInfo } from './Database'
import * as constants from './constants'

class NoteView extends React.Component {
  state = {
    id: ''
  }

  async getListOfOneNote(index, page) {
    let notesResponse
    await getNoteInfo(this.props.id)
      .then(response => {
        notesResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return notesResponse
  }

  render() {
    return (
      <NoteList
        key={'note' + this.props.id}
        viewMode={constants.view_modes.FULL}
        editFirst={this.props.edit}
        getListOfNotes={this.getListOfOneNote.bind(this)}
      />
    )
  }
}

export default NoteView
