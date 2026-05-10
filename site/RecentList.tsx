import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'

class RecentList extends React.Component<any, any> {
  async getListOfNotes(index: any, page: any) {
    var notesResponse
    await db
      .getRecentNotes(page)
      .then((response: any) => {
        notesResponse = response
      })
      .catch((error: any) => {
        console.error(error)
      })

    return notesResponse
  }

  render() {
    this.props.setPageTitle('Commonplace')
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
