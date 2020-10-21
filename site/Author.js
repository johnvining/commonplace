import React from 'react'
import NoteList from './NoteList'
import { deleteRecord, getInfo, types, getRecordsWithFilter } from './Database'
import { navigate, Link } from '@reach/router'
import * as constants from './constants'
import ResultWork from './ResultWork'

class Author extends React.Component {
  state = {
    id: ''
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
    getInfo(types.auth, authorId)
      .then(response => {
        this.setState({
          authorName: response.data.data.name,
          bornYear: response.data.data.bornYear,
          diedYear: response.data.data.diedYear
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  fetchAuthorWorks(authorId) {
    getRecordsWithFilter(types.work, types.auth, authorId)
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
    let notesResponse
    if (index == undefined) {
      await getRecordsWithFilter(types.note, types.auth, this.state.id)
        .then(response => {
          notesResponse = response
        })
        .catch(error => {
          console.error(error)
        })
    } else {
      let workId = this.state.works[index]?._id
      await getRecordsWithFilter(types.note, types.work, workId)
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
      !confirm(`Do you want to permanently delete '${this.state.authorName}'?`)
    ) {
      return
    }

    await deleteRecord(types.auth, this.state.id)
    navigate('/')
  }

  render() {
    return (
      <div>
        <div align="right" key="author-information">
          <span className="title">{this.state.authorName}</span>
          <br />
          {this.state.bornYear} - {this.state.diedYear}
          <div>
            <button
              className="top-level button"
              onClick={this.deleteAuthor.bind(this)}
            >
              Delete author
            </button>
          </div>
        </div>
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
