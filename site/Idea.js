import React from 'react'
import NoteList from './NoteList'
import { getNotesForIdea, getIdeaInfo } from './Database'

// TODO: Convert to new NoteList structure - give NoteList call backs for fetching data
class Idea extends React.Component {
  state = {
    id: ''
  }

  componentDidMount() {
    this.fetchData(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchData(this.state.id)
    }
  }

  fetchData(ideaId) {
    const ideaNotesRequest = getNotesForIdea(ideaId)
    const ideaInfoRequest = getIdeaInfo(ideaId)

    Promise.all([ideaNotesRequest, ideaInfoRequest])
      .then(response => {
        this.setState({
          notes: response[0].data.data,
          ideaName: response[1].data.data.name
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

  render() {
    return (
      <div>
        <div align="right">
          <span className="title">{this.state.ideaName}</span>
        </div>

        <NoteList notes={this.state.notes} useSlim={this.props.slim} />
      </div>
    )
  }
}

export default Idea
