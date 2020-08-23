import React from 'react'
import axios from 'axios'
import Note from './Note'

// TODO: Clean up all URLs

class Author extends React.Component {
  state = { loading: true }

  componentDidMount() {
    let url = `http://localhost:3000/api/auth/${this.props.id}/notes`
    axios
      .get(url)
      .then(response => {
        this.setState({
          notes: response.data.data
        })
      })
      .catch(error => {
        console.log(error)
      })

    let authorUrl = `http://localhost:3000/api/auth/${this.props.id}`
    axios
      .get(authorUrl)
      .then(response => {
        this.setState({
          authorName: response.data.data.name,
          bornYear: response.data.data.bornYear,
          diedYear: response.data.data.diedYear
        })

        document.title = this.state.authorName
      })
      .catch(error => {
        console.log(error)
      })
  }

  // TODO: Split up note page and note display so I can use the note diplsay here
  // TODO: Better formatting for author name
  // TODO: Way to do this without two database calls?
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

        {this.state.notes === undefined ? (
          <h2>Nothing</h2>
        ) : (
          <div>
            {this.state.notes.map(note => {
              return (
                <Note
                  title={note.title}
                  author={note.author.name}
                  authorId={note.authorId}
                  text={note.text}
                  ideas={note.ideas}
                  id={note._id}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }
}

export default Author
