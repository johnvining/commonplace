import React from 'react'
import NoteList from './NoteList'
import WorkList from './WorkList'
import {
  getNotesForPile,
  getPileInfo,
  deleteIdea,
  getWorksForPile
} from './Database'
import { navigate } from '@reach/router'
import * as constants from './constants'

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

  fetchPileInfo(pileID) {
    getPileInfo(pileID)
      .then(response => {
        this.setState({
          pileName: response.data.data[0].name
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

  async deleteIdea() {
    if (
      !confirm(`Do you want to permanently delete '${this.state.pileName}'?`)
    ) {
      return
    }

    await deleteIdea(this.state.id)
    navigate('/')
  }

  async getListOfNotes() {
    let notesResponse
    await getNotesForPile(this.state.id)
      .then(response => {
        notesResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return notesResponse
  }

  async getListOfWorks() {
    let worksResponse
    await getWorksForPile(this.state.id)
      .then(response => {
        worksResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return worksResponse
  }

  render() {
    return (
      <div>
        <div align="right">
          <span className="title">{this.state.pileName}</span>
          <div>
            <button
              className="top-level button"
              onClick={this.deleteIdea.bind(this)}
            >
              Delete pile
            </button>
          </div>
        </div>
        <WorkList
          key={'workList' + this.props.id}
          getListOfWorks={this.getListOfWorks.bind(this)}
        ></WorkList>
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
