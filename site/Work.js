import React from 'react'
import { Link } from '@reach/router'
import NoteList from './NoteList'
import {
  getWorkInfo,
  getNotesForWork,
  addAuthorToWork,
  createAuthorAndAddToWork,
  addUrlToWork,
  addYearToWork,
  getAuthorSuggestions,
  deleteWork,
  updateWorkInfo
} from './Database'
import Autocomplete from './Autocomplete'
import FreeEntry from './FreeEntry'
import link from './icons/link.svg'
import { guessYearFromURL } from './utils'
import { navigate } from '@reach/router'

class Work extends React.Component {
  state = {
    id: '',
    edit: false,
    pendingWorkTitle: '',
    pendingUrl: '',
    pendingYear: '',
    pendingAuthorName: ''
  }

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
          pendingWorkTitle: response.data.data.name,
          piles: response.data.data.piles,
          pendingAuthorName: response.data.data.author?.name,
          pendingUrl: response.data.data.url,
          pendingYear: response.data.data.year
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
    this.setState({ pendingAuthorName: authorName, pendingAuthorId: authorId })
  }

  handleCreateAuthorAndAssign(authorName) {
    this.setState({ pendingAuthorName: authorName })
    createAuthorAndAddToWork(this.props.id, authorName).then(response => {
      this.setState({
        pendingAuthorId: response.data.data.id
      })
    })
  }

  async deleteWork() {
    if (
      !confirm(
        `Do you want to permanently delete '${this.state.pendingWorkTitle}'?`
      )
    ) {
      return
    }

    await deleteWork(this.state.id)
    navigate('/')
  }

  async handleAcceptUpdates() {
    const updateObject = {
      author: this.state.pendingAuthorId,
      year: this.state.pendingYear,
      url: this.state.pendingUrl,
      name: this.state.pendingWorkTitle
    }
    updateWorkInfo(this.props.id, updateObject)
    this.setState({ edit: false })
  }

  render() {
    var { pendingWorkTitle, pendingUrl, pendingYear } = this.state

    return (
      <div>
        <div>
          {/* Piles */}
          <div className="work-page form-container">
            {this.state.piles?.map(pile => (
              <Link to={'/pile/' + pile._id} key={'/pile/' + pile._id}>
                <span className="pile label">{pile.name}</span>
              </Link>
            ))}
          </div>
          {/* Title */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <input
                className="work-page title"
                defaultValue={pendingWorkTitle}
                onChange={e => {
                  this.setState({ pendingWorkTitle: e.target.value })
                }}
              />
            ) : (
              <span className="work-page title">{pendingWorkTitle}</span>
            )}
          </div>
          {/* Author */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <Autocomplete
                inputName="work-author"
                className={'work-page author-select'}
                dontAutofocus={true}
                defaultValue={this.state.pendingAuthorName || ''}
                escape={() => {
                  this.setState({ edit: false })
                }}
                onSelect={this.handleUpdateAuthor.bind(this)}
                getSuggestions={getAuthorSuggestions}
                handleNewSelect={this.handleCreateAuthorAndAssign.bind(this)}
              />
            ) : (
              <div className={'work-page author'}>
                {this.state.pendingAuthorName}
              </div>
            )}
          </div>
          {/* URL */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <input
                defaultValue={pendingUrl}
                className="work-page url"
                onChange={e => {
                  this.setState({ pendingUrl: e.target.value })
                }}
              />
            ) : (
              <span className="work-page url">{pendingUrl}</span>
            )}
          </div>
          {/* Year */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <input
                defaultValue={pendingYear}
                className="work-page year"
                onChange={e => {
                  this.setState({ pendingYear: e.target.value })
                }}
              />
            ) : (
              <span className="work-page year">{pendingYear}</span>
            )}
          </div>
          {/* Buttons */}
          <div>
            {this.state.edit ? (
              <button
                className="top-level button"
                onClick={this.handleAcceptUpdates.bind(this)}
              >
                Done
              </button>
            ) : (
              <>
                <button
                  className="top-level button"
                  onClick={() => {
                    this.setState({ edit: true })
                  }}
                >
                  Edit
                </button>
                <button
                  className="top-level button"
                  onClick={this.deleteWork.bind(this)}
                >
                  Delete
                </button>
              </>
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
