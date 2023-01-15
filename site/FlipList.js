import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'

class FlipList extends React.Component {
  async getListOfNotes(index, page) {
    var notesResponse
    await db
      .getRandomNotes()
      .then(response => {
        notesResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return notesResponse
  }

  render() {
    this.props.setPageTitle('Flip')
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

export default FlipList
