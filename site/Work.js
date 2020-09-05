import React from 'react'
import NoteList from './NoteList'
import {
  getWorkInfo,
  getNotesForWork,
  addAuthorToWork,
  createAuthorAndAddToWork,
  addUrlToWork,
  addYearToWork,
  getAuthorSuggestions
} from './Database'
import Autocomplete from './Autocomplete'
import FreeEntry from './FreeEntry'
import link from './icons/link.svg'

class Work extends React.Component {
  state = { id: '', editAuthor: false }

  componentDidMount() {
    this.fetchWorkInfo(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchWorkInfo(this.state.id)
    }
  }

  fetchWorkInfo(workId) {
    getWorkInfo(workId)
      .then(response => {
        this.setState({
          work: response.data.data.name,
          authorName: response.data.data.author?.name,
          url: response.data.data.url,
          year: response.data.data.year
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  async getListOfNotes() {
    let notesResponse
    await getNotesForWork(this.state.id)
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

  handleUpdateAuthor = (authorId, authorName) => {
    this.setState({ authorName: authorName, authorId: authorId })
    addAuthorToWork(this.props.id, authorId).then(
      this.setState({
        editAuthor: false
      })
    )
  }

  handleCreateAuthorAndAssign(authorName) {
    this.setState({ authorName: authorName })
    createAuthorAndAddToWork(this.props.id, authorName).then(response => {
      this.setState({
        authorId: response.data.data.id,
        editAuthor: false
      })
    })
  }

  submitUrl(text) {
    addUrlToWork(this.props.id, text).then(
      this.setState({ editUrl: false, url: text })
    )
  }

  submitYear(text) {
    addYearToWork(this.props.id, text).then(
      this.setState({ editYear: false, year: text })
    )
  }

  render() {
    const { authorName, editAuthor, url, year } = this.state

    return (
      <div>
        <div className="top-right">
          <div>
            <span className="title">{this.state.work}</span>
          </div>
          <div>
            {editAuthor || authorName == null || authorName?.length == 0 ? (
              <Autocomplete
                inputName="work-author"
                className={'work-author-label'}
                defaultValue={authorName}
                escape={() => {
                  this.setState({ editAuthor: false })
                }}
                onSelect={this.handleUpdateAuthor.bind(this)}
                getSuggestions={getAuthorSuggestions}
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
          <div>
            {this.state.editUrl ? (
              <FreeEntry
                defaultValue={url}
                escape={() => {
                  this.setState({ editUrl: false })
                }}
                submit={this.submitUrl.bind(this)}
              />
            ) : url?.length ? (
              <div>
                <span
                  className="url"
                  onClick={() => {
                    // TODO: Fix accessibility
                    this.setState({ editUrl: true })
                  }}
                >
                  {url}
                </span>
                <a href={url}>
                  <img src={link} />
                </a>
              </div>
            ) : (
              <span
                className="url"
                onClick={() => {
                  this.setState({ editUrl: true })
                }}
              >
                no url
              </span>
            )}
          </div>
          <div>
            {this.state.editYear ? (
              <FreeEntry
                defaultValue={year}
                escape={() => {
                  this.setState({ editYear: false })
                }}
                submit={this.submitYear.bind(this)}
              />
            ) : year != undefined ? (
              <div>
                <span
                  className="year"
                  onClick={() => {
                    // TODO: Fix accessibility
                    this.setState({ editYear: true })
                  }}
                >
                  {year}
                </span>
              </div>
            ) : (
              <span
                className="year"
                onClick={() => {
                  this.setState({ editYear: true })
                }}
              >
                no year
              </span>
            )}
          </div>
        </div>

        <NoteList
          key={'work' + this.props.id}
          viewMode={this.props.viewMode}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Work
