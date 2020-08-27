import React from 'react'
import NoteList from './NoteList'
import { getAuthorInfo, getNotesForAuthor } from './Database'

class Author extends React.Component {
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

  fetchData(authorId) {
    const authorNotesRequest = getNotesForAuthor(authorId)
    const authorInfoRequest = getAuthorInfo(authorId)

    Promise.all([authorNotesRequest, authorInfoRequest]).then(response => {
      this.setState({
        notes: response[0].data.data,
        authorName: response[1].data.data.name,
        bornYear: response[1].data.data.bornYear,
        diedYear: response[1].data.data.diedYear
      })
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
          <span className="title">{this.state.authorName}</span>
          <br />
          {this.state.bornYear} - {this.state.diedYear}
        </div>

        <NoteList notes={this.state.notes} useSlim={this.props.slim} />
      </div>
    )
  }
}

export default Author
