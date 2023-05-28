import { useNavigate } from 'react-router-dom'
import * as constants from './constants'
import * as db from './Database'
import NoteList from './NoteList'
import React from 'react'
import WorkList from './WorkList'
import YearSpan from './YearSpan'
import { Link } from 'react-router-dom'

class Pile extends React.Component {
  state = {
    id: '',
    edit: false,
    pendingName: '',
    pendingStartYear: '',
    pendingEndYear: '',
  }

  componentDidMount() {
    this.fetchPileInfo(this.props.id)
  }

  componentDidUpdate(prevState) {
    if (prevState.id !== this.state.id) {
      this.fetchPileInfo(this.state.id)
    }
  }

  fetchPileInfo(pileId) {
    db.getInfo(db.types.pile, pileId)
      .then((response) => {
        this.setState({
          pendingName: response.data.data.name,
          pendingStartYear: response.data.data.start_year,
          pendingEndYear: response.data.data.end_year,
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.id !== prevState.id) {
      return { id: nextProps.id }
    }

    return null
  }

  async handleDeletePile() {
    if (
      !confirm(`Do you want to permanently delete '${this.state.pendingName}'?`)
    ) {
      return
    }

    await db.deleteRecord(db.types.pile, this.state.id)
    const navigate = useNavigate()
    navigate('/')
  }

  async getListOfNotes() {
    var notesResponse
    await db
      .getRecordsWithFilter(db.types.note, db.types.pile, this.state.id)
      .then((response) => {
        notesResponse = response
      })
      .catch((error) => {
        console.error(error)
      })

    return notesResponse
  }

  async getListOfWorks() {
    var worksResponse
    await db
      .getRecordsWithFilter(db.types.work, db.types.pile, this.state.id)
      .then((response) => {
        worksResponse = response
      })
      .catch((error) => {
        console.error(error)
      })

    return worksResponse
  }

  async handleAcceptUpdates() {
    var updateObject = {
      name: this.state.pendingName,
      start_year: this.state.pendingStartYear,
      end_year: this.state.pendingEndYear,
    }

    db.updateRecord(db.types.pile, this.props.id, updateObject)
    this.setState({ edit: false })
  }

  render() {
    this.props.setPageTitle(this.state.pendingName)
    return (
      <div>
        {/* Header and Edit */}
        <div key="pile-information">
          {this.state.edit ? (
            <>
              <label htmlFor="title" className="work-page form-label">
                Name
              </label>
              <input
                className="work-page title input"
                id="title"
                defaultValue={this.state.pendingName}
                onChange={(e) => {
                  this.setState({ pendingName: e.target.value })
                }}
              />
              <label htmlFor="startYear" className="work-page form-label">
                Start Year
              </label>
              <input
                className="work-page title input"
                id="startYear"
                defaultValue={this.state.pendingStartYear}
                onChange={(e) => {
                  this.setState({ pendingStartYear: e.target.value })
                }}
              />
              <label htmlFor="endYear" className="work-page form-label">
                End Year
              </label>
              <input
                className="work-page title input"
                id="endYear"
                defaultValue={this.state.pendingEndYear}
                onChange={(e) => {
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
                  {this.state.pendingStartYear ? (
                    <YearSpan year={this.state.pendingStartYear} />
                  ) : null}
                  {this.state.pendingStartYear && this.state.pendingEndYear
                    ? ' to '
                    : null}
                  {this.state.pendingEndYear ? (
                    <YearSpan year={this.state.pendingEndYear} />
                  ) : null}
                </div>
              ) : null}
              <div>
                <button
                  className="top-level standard-button"
                  onClick={this.handleDeletePile.bind(this)}
                >
                  Delete
                </button>
                <button
                  className="top-level standard-button"
                  onClick={() => {
                    this.setState({ edit: true })
                  }}
                >
                  Edit
                </button>
                {this.props.showNotes ? (
                  ''
                ) : (
                  <Link to={'/pile/' + this.state.id + '/notes'}>
                    <button
                      className="top-level standard-button"
                      style={{ marginLeft: '4px' }} // Margins come from standard-button + standard-button which doesn't work becasue of the <a>
                    >
                      Notes
                    </button>
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        {/* Note and Work List */}
        {this.props.showNotes ? (
          <NoteList
            key={'noteList' + this.props.id}
            viewMode={this.props.viewMode}
            getListOfNotes={this.getListOfNotes.bind(this)}
          />
        ) : (
          <>
            <WorkList
              key={'workList' + this.props.id}
              getListOfWorks={this.getListOfWorks.bind(this)}
            />
            <NoteList
              key={'noteList' + this.props.id}
              viewMode={constants.view_modes.RESULT}
              getListOfNotes={this.getListOfNotes.bind(this)}
            />
          </>
        )}
      </div>
    )
  }
}

export default Pile
