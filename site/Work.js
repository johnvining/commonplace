import React from 'react'
import { Link } from '@reach/router'
import NoteList from './NoteList'
import {
  types,
  getInfo,
  getNotesForWork,
  createAuthorAndAddToWork,
  getSuggestions,
  deleteRecord,
  updateRecord,
  addPileToWork,
  createPileAndAddToWork,
  removePileFromWork
} from './Database'
import Autocomplete from './Autocomplete'
import PileListForItem from './PileListForItem'
import { guessYearFromURL } from './utils'
import { navigate } from '@reach/router'

class Work extends React.Component {
  state = {
    id: '',
    edit: false,
    editPiles: false,
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
    getInfo(types.work, workId)
      .then(response => {
        this.setState({
          pendingWorkTitle: response.data.data.name,
          piles: response.data.data.piles,
          pendingAuthorName: response.data.data.author?.name,
          pendingAuthorId: response.data.data.author?._id,
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

    await deleteRecord(types.work, this.state.id)
    navigate('/')
  }

  async handleAcceptUpdates() {
    var updateObject = {
      author: this.state.pendingAuthorId,
      year: this.state.pendingYear,
      url: this.state.pendingUrl,
      name: this.state.pendingWorkTitle
    }

    updateRecord(types.work, this.props.id, updateObject)
    this.setState({ edit: false })
  }

  async handleNewPile(pile) {
    addPileToWork(pile, this.props.id).then(() => {
      this.fetchWorkInfo(this.props.id)
    })
  }

  async handleCreatePileAndAssign(pileName) {
    createPileAndAddToWork(pileName, this.props.id).then(() => {
      this.fetchWorkInfo(this.props.id)
    })
  }

  async handleClearAuthor() {
    this.setState({ pendingAuthorId: null, pendingAuthorName: '' })
  }

  async handlePileRemove(pileId) {
    removePileFromWork(this.state.id, pileId).then(() => {
      this.fetchWorkInfo(this.props.id)
    })
  }

  render() {
    var { pendingWorkTitle, pendingUrl, pendingYear } = this.state

    return (
      <div>
        <div>
          {/* Piles */}
          <div className="work-page form-container">
            <PileListForItem
              remove={this.state.edit}
              edit={this.state.editPiles}
              piles={this.state.piles}
              onSelect={this.handleNewPile.bind(this)}
              getSuggestions={getSuggestions}
              apiType={types.pile}
              handleNewSelect={this.handleCreatePileAndAssign.bind(this)}
              mainClassName="work-page"
              onStartEdit={() => {
                this.setState({ editPiles: true })
              }}
              onPileRemove={this.handlePileRemove.bind(this)}
            />
          </div>
          {/* Title */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <>
                <label htmlFor="title" className="work-page form-label">
                  Title
                </label>
                <input
                  className="work-page title input"
                  id="title"
                  defaultValue={pendingWorkTitle}
                  onChange={e => {
                    this.setState({ pendingWorkTitle: e.target.value })
                  }}
                />
              </>
            ) : (
              <span className="work-page title">{pendingWorkTitle}</span>
            )}
          </div>
          {/* Author */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <>
                <label htmlFor="work-author" className="work-page form-label">
                  Author
                </label>
                <Autocomplete
                  inputName="work-author"
                  className={'work-page author-select'}
                  dontAutofocus={true}
                  defaultValue={this.state.pendingAuthorName || ''}
                  onSelect={this.handleUpdateAuthor.bind(this)}
                  getSuggestions={getSuggestions}
                  apiType={types.auth}
                  handleNewSelect={this.handleCreateAuthorAndAssign.bind(this)}
                  onClearText={this.handleClearAuthor.bind(this)}
                />
              </>
            ) : (
              <div className={'work-page author'}>
                <Link to={'/auth/' + this.state.pendingAuthorId}>
                  {this.state.pendingAuthorName}
                </Link>
              </div>
            )}
          </div>
          {/* URL */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <>
                <label htmlFor="url" className="work-page form-label">
                  URL
                </label>
                <input
                  defaultValue={pendingUrl}
                  id="url"
                  className="work-page url input"
                  onChange={e => {
                    this.setState({ pendingUrl: e.target.value })
                  }}
                />
              </>
            ) : (
              <span className="work-page url">{pendingUrl}</span>
            )}
          </div>
          {/* Year */}
          <div className="work-page  form-container">
            {this.state.edit ? (
              <>
                <label htmlFor="year" className="work-page form-label">
                  Year
                </label>
                <input
                  defaultValue={pendingYear}
                  className="work-page year input"
                  onChange={e => {
                    this.setState({ pendingYear: e.target.value })
                  }}
                />
              </>
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
                    this.setState({ edit: true, editPiles: false })
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
