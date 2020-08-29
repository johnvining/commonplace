import React from 'react'
import axios from 'axios'
import NoteList from './NoteList'
import * as db from './Database'

class RecentList extends React.Component {
  state = { loading: true }

  componentDidMount() {
    console.log('recentList-componentDidMount')
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)
  }

  async getListOfNotes() {
    console.log('recentList-fetchListOfNotes')
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

  componentWillUnmount() {
    document.removeEventListener(
      'keydown',
      this.handleKeyDown.bind(this),
      false
    )
  }

  handleKeyDown(event) {
    // TODO: Keyboard short cuts will interfere with Ctrl + A on Windows
    if (event.keyCode == 13) {
      // TODO: This is clumsy -- need to avoid inner elements like Input's or anything that happens while note is being edited
      if (document.activeElement.className == 'noteNormal-outer') {
        this.setIsFocused(document.activeElement.id)
      }
    }
  }

  setIsFocused(id) {
    this.setState({
      inFocus: id
    })
  }

  becomeInFocus(id) {
    this.setState({ inFocus: id })
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
