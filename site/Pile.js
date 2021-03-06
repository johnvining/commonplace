import { navigate } from '@reach/router'
import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import WorkList from './WorkList'

class Pile extends React.Component {
  state = {
    id: ''
  }

  componentDidMount() {
    this.fetchPileInfo(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchPileInfo(this.state.id)
    }
  }

  fetchPileInfo(pileId) {
    db.getInfo(db.types.pile, pileId)
      .then(response => {
        this.setState({
          pileName: response.data.data.name
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.id !== prevState.id) {
      return { id: nextProps.id }
    }

    return null
  }

  async handleDeletePile() {
    if (
      !confirm(`Do you want to permanently delete '${this.state.pileName}'?`)
    ) {
      return
    }

    await db.deleteRecord(db.types.pile, this.state.id)
    navigate('/')
  }

  async getListOfNotes() {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.pile, this.state.id)
      .then(response => {
        notesResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return notesResponse
  }

  async getListOfWorks() {
    var worksResponse
    await db
      .getRecordsWithFilter(db.types.work, db.types.pile, this.state.id)
      .then(response => {
        worksResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return worksResponse
  }

  render() {
    this.props.setPageTitle(this.state.pileName)
    return (
      <div>
        <div align="right">
          <span className="title">{this.state.pileName}</span>
          <div>
            <button
              className="top-level button"
              onClick={this.handleDeletePile.bind(this)}
            >
              Delete pile
            </button>
          </div>
        </div>
        <WorkList
          key={'workList' + this.props.id}
          getListOfWorks={this.getListOfWorks.bind(this)}
        />
        <NoteList
          key={'noteList' + this.props.id}
          viewMode={constants.view_modes.RESULT}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Pile
