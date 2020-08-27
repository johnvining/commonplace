import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'
import Autocomplete from './Autocomplete'

class Work extends React.Component {
  state = { id: '', editAuthor: false }

  componentDidMount() {
    this.fetchData(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchData(this.state.id)
    }
  }

  fetchData(workId) {
    const workNotesRequest = db.getNotesForWork(workId)
    const workInfoRequest = db.getWorkInfo(workId)

    Promise.all([workNotesRequest, workInfoRequest])
      .then(response => {
        this.setState({
          notes: response[0].data.data,
          work: response[1].data.data.name,
          authorName: response[1].data.data.author?.name
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
            <span className="title">{this.state.work}</span>
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

        <NoteList notes={this.state.notes} useSlim={this.props.slim} />
      </div>
    )
  }
}

export default Work
