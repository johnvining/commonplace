import React from 'react'
import NoteList from './NoteList'
import { getNotesForIdea, getIdeaInfo } from './Database'

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
    getIdeaInfo(ideaId)
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

  render() {
    return (
      <div>
        <div align="right">
          <span className="title">{this.state.ideaName}</span>
        </div>

        <NoteList
          key={'idea' + this.props.id}
          useGridView={false}
          useSlim={false}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Idea
