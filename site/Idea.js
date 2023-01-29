import { navigate } from '@reach/router'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'

class Idea extends React.Component {
  state = {
    id: '',
    edit: false,
    pendingName: '',
    pendingStartYear: '',
    pendingEndYear: ''
  }

  componentDidMount() {
    this.fetchIdeaInfo(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchIdeaInfo(this.state.id)
    }
  }

  fetchIdeaInfo(ideaId) {
    db.getInfo(db.types.idea, ideaId)
      .then(response => {
        this.setState({
          pendingName: response.data.data.name,
          pendingStartYear: response.data.data.start_year,
          pendingEndYear: response.data.data.end_year
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  async getListOfNotes() {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.idea, this.state.id)
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

  async deleteIdea() {
    if (
      !confirm(`Do you want to permanently delete '${this.state.ideaName}'?`)
    ) {
      return
    }

    await db.deleteRecord(db.types.idea, this.state.id)
    navigate('/')
  }

  async handleAcceptUpdates() {
    var updateObject = {
      name: this.state.pendingName,
      start_year: this.state.pendingStartYear,
      end_year: this.state.pendingEndYear
    }

    console.log(updateObject)

    db.updateRecord(db.types.idea, this.props.id, updateObject)
    this.setState({ edit: false })
  }

  render() {
    this.props.setPageTitle(this.state.pendingName)
    return (
      <div>
        {/* Header and Edit */}
        <div key="idea-information">
          {this.state.edit ? (
            <>
              <label htmlFor="title" className="work-page form-label">
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
              <label htmlFor="startYear" className="work-page form-label">
                Start Year
              </label>
              <input
                className="work-page title input"
                id="title"
                defaultValue={this.state.pendingStartYear}
                onChange={e => {
                  this.setState({ pendingStartYear: e.target.value })
                }}
              />
              <label htmlFor="endYear" className="work-page form-label">
                End Year
              </label>
              <input
                className="work-page title input"
                id="title"
                defaultValue={this.state.pendingEndYear}
                onChange={e => {
                  this.setState({ pendingEndYear: e.target.value })
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
              {this.state.pendingStartYear || this.state.pendingEndYear ? (
                <div className="page-sub-title">
                  {this.state.pendingStartYear
                    ? this.state.pendingStartYear
                    : null}
                  {this.state.pendingStartYear && this.state.pendingEndYear
                    ? ' to '
                    : null}
                  {this.state.pendingEndYear ? this.state.pendingEndYear : null}
                </div>
              ) : null}
              <div>
                <button
                  className="top-level standard-button"
                  onClick={this.deleteIdea.bind(this)}
                >
                  Delete idea
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

        {/* Note List */}
        <NoteList
          key={'idea' + this.props.id}
          viewMode={this.props.viewMode}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Idea
