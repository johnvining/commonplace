import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'

class FileList extends React.Component {
  async getListOfNotes(index, page) {
    var notesResponse
    await db
      .getEarliestNotesToFile(page)
      .then(response => {
        notesResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return notesResponse
  }

  render() {
    this.props.setPageTitle('Notes to file')
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

export default FileList
