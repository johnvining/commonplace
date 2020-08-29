import React from 'react'
import NoteList from './NoteList'
import { getAuthorInfo, getNotesForAuthor } from './Database'

// TODO: Convert to new NoteList structure - give NoteList call backs for fetching data
class Author extends React.Component {
  state = {
    id: ''
  }

  componentDidMount() {
    this.fetchAuthorInfo(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchAuthorInfo(this.state.id)
    }
  }

  fetchAuthorInfo(authorId) {
    getAuthorInfo(authorId).then(response => {
      this.setState({
        authorName: response.data.data.name,
        bornYear: response.data.data.bornYear,
        diedYear: response.data.data.diedYear
      })
    })
  }

  async getListOfNotes() {
    let notesResponse
    await getNotesForAuthor(this.state.id)
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
          <span className="title">{this.state.authorName}</span>
          <br />
          {this.state.bornYear} - {this.state.diedYear}
        </div>

        <NoteList
          useGridView={false}
          useSlim={false}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Author
