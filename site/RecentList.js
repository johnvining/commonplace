import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'

class RecentList extends React.Component {
  async getListOfNotes(index, page) {
    let notesResponse
    await db
      .getRecentNotes(page)
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
          key={'recent'}
          viewMode={this.props.viewMode}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default RecentList
