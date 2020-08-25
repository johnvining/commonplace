import React from 'react'
import Note from './Note'
import * as db from './Database'
import Autocomplete from './Autocomplete'

// TODO: Display Work in notes
class Work extends React.Component {
  state = { loading: true, newId: false, editAuthor: false }

  // TODO: Clean up -- https://stackoverflow.com/questions/48139281/react-doesnt-reload-component-data-on-route-param-change-or-query-change
  // TODO: DRY
  // TODO: Adding ideas doesn't refresh automatically
  componentDidMount() {
    db.getNotesForWork(this.props.id)
      .then(response => {
        this.setState({
          notes: response.data.data
        })
      })
      .catch(error => {
        console.error(error)
      })
    db.getWorkInfo(this.props.id)
      .then(response => {
        console.log(response)
        this.setState({
          ideaName: response.data.data.name,
          authorName: response.data.data.author?.name
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  componentDidUpdate() {
    if (this.state.newId) {
      this.setState({ newId: false }, () => {
        db.getNotesForWork(this.props.id)
          .then(response => {
            this.setState({
              notes: response.data.data
            })
          })
          .catch(error => {
            console.error(error)
          })
        db.getWorkInfo(this.props.id)
          .then(response => {
            this.setState({
              workName: response.data.data.name,
              authorName: response.data.data.author?.name
            })
          })
          .catch(error => {
            console.error(error)
          })
      })
    }
  }

  static getDerivedStateFromProps(next, prev) {
    if (next.id != prev.id) {
      return {
        id: next.id,
        newId: true
      }
    }
    return next
  }

  handleUpdateAuthor = (authorId, authorName) => {
    this.setState({ authorName: authorName, authorId: authorId })
    db.addAuthorToWork(this.props.id, authorId).then(
      this.setState({
        editAuthor: false
      })
    )
  }

  handleCreateAuthorAndAssign(authorName) {
    this.setState({ authorName: authorName })
    db.createAuthorAndAddToWork(this.props.id, authorName).then(response => {
      this.setState({
        authorId: response.data.data.id,
        editAuthor: false
      })
    })
  }

  render() {
    const { authorName, editAuthor } = this.state

    return (
      <div>
        <div className="top-right">
          <div>
            <span className="title">{this.state.ideaName}</span>
          </div>
          <div>
            {editAuthor || authorName == null || authorName?.length == 0 ? (
              <Autocomplete
                className={'work-author-label'}
                defaultValue={authorName}
                escape={() => {
                  this.setState({ editAuthor: false })
                }}
                onSelect={this.handleUpdateAuthor.bind(this)}
                getSuggestions={db.getAuthorSuggestions}
                handleNewSelect={this.handleCreateAuthorAndAssign.bind(this)}
              />
            ) : (
              <div
                className="work-author-label"
                onClick={() => {
                  // TODO: Fix accessibility
                  this.setState({ editAuthor: true })
                }}
              >
                {authorName}
              </div>
            )}
          </div>
        </div>

        {this.state.notes === undefined ? null : (
          <div>
            {this.state.notes.map(note => {
              return (
                <Note
                  key={'note-' + note._id}
                  title={note.title}
                  author={note.author?.name}
                  authorId={note.author?._id}
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

export default Work
