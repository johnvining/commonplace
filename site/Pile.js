import React from 'react'
import NoteList from './NoteList'
import { getNotesForIdea, getPileInfo, deleteIdea } from './Database'
import { navigate } from '@reach/router'

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
          pileName: response.data.data.name
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  async getListOfNotes() {
    let notesResponse
    await getNotesForIdea(this.state.id)
      .then(response => {
        notesResponse = response
      })
      .catch(error => {
        console.error(error)
      })

    return notesResponse
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

        {/* <NoteList
          key={'idea' + this.props.id}
          viewMode={this.props.viewMode}
          getListOfNotes={this.getListOfNotes.bind(this)}
        /> */}
      </div>
    )
  }
}

export default Pile
