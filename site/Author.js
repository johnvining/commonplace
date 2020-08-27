import React from 'react'
import NoteList from './NoteList'
import { getAuthorInfo, getNotesForAuthor } from './Database'

// TODO: Fix going author -> author now that it's possible with search bar
class Author extends React.Component {
  state = { loading: true }

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

    Promise.all([authorNotesRequest, authorInfoRequest])
      .then(response => {
        this.setState({
          notes: response[0].data.data,
          authorName: response[1].data.data.name,
          bornYear: response[1].data.data.bornYear,
          diedYear: response[1].data.data.diedYear
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

  // TODO: Split up note page and note display so I can use the note diplsay here
  // TODO: Better formatting for author name
  render() {
    return (
      <div>
        <div align="right">
          <span className="title">
            {' '}
            {/* TODO: This is horrible */}
            <small>
              <small>{this.state.authorName}</small>
              <small>
                <small>
                  <small>
                    <small>
                      <small>
                        <br />
                        {this.state.bornYear} - {this.state.diedYear}
                      </small>
                    </small>
                  </small>
                </small>
              </small>
            </small>
          </span>
        </div>

        <NoteList notes={this.state.notes} useSlim={this.props.slim} />
      </div>
    )
  }
}

export default Author
