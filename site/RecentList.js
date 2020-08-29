import React from 'react'
import axios from 'axios'
import NoteList from './NoteList'
import * as db from './Database'

class RecentList extends React.Component {
  async getListOfNotes() {
    let notesResponse
    await db
      .getRecentNotes()
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
      <div>
        <NoteList
          useGridView={false}
          useSlim={false}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default RecentList
