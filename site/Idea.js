import React from 'react'
import NoteList from './NoteList'
import { removeFromRecord, getInfo, deleteRecord, types } from './Database'
import { navigate } from '@reach/router'

class Idea extends React.Component {
  state = {
    id: ''
  }

  componentDidMount() {
    this.fetchIdeaInfo(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchIdeaInfo(this.state.id)
    }
  }

  fetchIdeaInfo(ideaId) {
    getInfo(types.idea, ideaId)
      .then(response => {
        this.setState({
          ideaName: response.data.data.name
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  async getListOfNotes() {
    let notesResponse
    await removeFromRecord(types.note, types.idea, this.state.id)
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
      !confirm(`Do you want to permanently delete '${this.state.ideaName}'?`)
    ) {
      return
    }

    await deleteRecord(types.idea, this.state.id)
    navigate('/')
  }

  render() {
    return (
      <div>
        <div align="right">
          <span className="title">{this.state.ideaName}</span>
          <div>
            <button
              className="top-level button"
              onClick={this.deleteIdea.bind(this)}
            >
              Delete idea
            </button>
          </div>
        </div>

        <NoteList
          key={'idea' + this.props.id}
          viewMode={this.props.viewMode}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Idea
