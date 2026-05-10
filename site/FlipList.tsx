import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'

class FlipList extends React.Component<any, any> {
  // eslint-disable-next-line no-unused-vars
  async getListOfNotes(_index: any, _page: any) {
    var notesResponse
    await db
      .getRandomNotes()
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
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
