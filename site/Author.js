import { navigate } from '@reach/router'
import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import ResultWork from './ResultWork'

class Author extends React.Component {
  state = {
    id: '',
    edit: false,
    pendingName: '',
    pendingBirthYear: '',
    pendingDeathYear: ''
  }

  componentDidMount() {
    this.fetchAuthorInfo(this.props.id)
    this.fetchAuthorWorks(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchAuthorInfo(this.state.id)
      this.fetchAuthorWorks(this.state.id)
    }
  }

  fetchAuthorInfo(authorId) {
    db.getInfo(db.types.auth, authorId)
      .then(response => {
        this.setState({
          pendingName: response.data.data.name,
          pendingBirthYear: response.data.data.birth_year,
          pendignDeathYear: response.data.data.death_year
        })
        this.props.setPageTitle(response.data.data.name)
      })
      .catch(error => {
        console.error(error)
      })
  }

  fetchAuthorWorks(authorId) {
    db.getRecordsWithFilter(db.types.work, db.types.auth, authorId)
      .then(response => {
        this.setState({
          works: response.data.data
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  async getListOfNotes(index, page) {
    var notesResponse
    if (index == undefined) {
      await db
        .getRecordsWithFilter(db.types.note, db.types.auth, this.state.id)
        .then(response => {
          notesResponse = response
        })
        .catch(error => {
          console.error(error)
        })
    } else {
      var workId = this.state.works[index]?._id
      await db
        .getRecordsWithFilter(db.types.note, db.types.work, workId)
        .then(response => {
          notesResponse = response
        })
        .catch(error => {
          console.error(error)
        })
    }

    return notesResponse
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.id !== prevState.id) {
      return { id: nextProps.id }
    }

    return null
  }

  async deleteAuthor() {
    if (
      !confirm(`Do you want to permanently delete '${this.state.pendingName}'?`)
    ) {
      return
    }

    await db.deleteRecord(db.types.auth, this.state.id)
    navigate('/')
  }

  async handleAcceptUpdates() {
    var updateObject = {
      name: this.state.pendingName,
      birth_year: this.state.pendingBirthYear,
      death_year: this.state.pendignDeathYear
    }

    db.updateRecord(db.types.auth, this.props.id, updateObject)
    this.setState({ edit: false })
  }

  render() {
    return (
      <div>
        {/* Header and Edit */}
        <div key="author-information">
          {this.state.edit ? (
            <>
              <label htmlFor="name" className="work-page form-label">
                Name
              </label>
              <input
                className="work-page title input"
                id="title"
                defaultValue={this.state.pendingName}
                onChange={e => {
                  this.setState({ pendingName: e.target.value })
                }}
              />
              <label htmlFor="birthYear" className="work-page form-label">
                Birth Year
              </label>
              <input
                className="work-page title input"
                id="title"
                defaultValue={this.state.pendingBirthYear}
                onChange={e => {
                  this.setState({ pendingBirthYear: e.target.value })
                }}
              />
              <label htmlFor="deathYear" className="work-page form-label">
                Death Year
              </label>
              <input
                className="work-page title input"
                id="title"
                defaultValue={this.state.pendingDeathYear}
                onChange={e => {
                  this.setState({ pendingDeathYear: e.target.value })
                }}
              />
              <button
                className="top-level standard-button left-right"
                onClick={this.handleAcceptUpdates.bind(this)}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <div className="page-title">{this.state.pendingName}</div>
              {this.state.pendingBirthYear || this.state.pendingDeathYear ? (
                <div className="page-sub-title">
                  {this.state.pendingBirthYear
                    ? 'b. ' + this.state.pendingBirthYear
                    : null}
                  {this.state.pendingDeathYear
                    ? ' d. ' + this.state.pendingDeathYear
                    : null}
                </div>
              ) : null}

              <div>
                <button
                  className="top-level standard-button"
                  onClick={this.deleteAuthor.bind(this)}
                >
                  Delete
                </button>
                <button
                  className="top-level standard-button"
                  onClick={() => {
                    this.setState({ edit: true, editPiles: false })
                  }}
                >
                  Edit
                </button>
              </div>
            </>
          )}
        </div>

        {/* Work List */}
        {this.state.works?.map((work, workindex) => (
          <div key={'work-listing-' + workindex}>
            <ResultWork work={work} key={'work-' + work._id} />
            <div className="result-box parent">
              <NoteList
                key={'notes-for-work' + work._id}
                index={workindex}
                viewMode={constants.view_modes.RESULT}
                getListOfNotes={this.getListOfNotes.bind(this)}
              />
            </div>
          </div>
        ))}
        <NoteList
          key={'auth' + this.props.id}
          viewMode={constants.view_modes.RESULT}
          useGroupings={true}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Author
