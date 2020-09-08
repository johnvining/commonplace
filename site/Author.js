import React from 'react'
import NoteList from './NoteList'
import {
  getAuthorInfo,
  getNotesForAuthor,
  getWorksForAuthor,
  getNotesForWork
} from './Database'

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
    getAuthorInfo(authorId)
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
    getWorksForAuthor(authorId)
      .then(response => {
        this.setState({
          works: response.data.data
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  // fetchNotesForWork(workId) {}

  // async fetchNotesforWorkIndex(workIndex) {
  //   // TODO: Get the id
  //   let notesResponse
  //   fetchNotesForWork(workId)
  //   return notesResponse
  // }

  async getListOfNotes(index) {
    let notesResponse
    if (index == undefined) {
      await getNotesForAuthor(this.state.id)
        .then(response => {
          notesResponse = response
        })
        .catch(error => {
          console.error(error)
        })
    } else {
      let workId = this.state.works[index]?._id
      await getNotesForWork(workId)
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

  render() {
    return (
      <div>
        <div align="right" key="author-information">
          <span className="title">{this.state.authorName}</span>
          <br />
          {this.state.bornYear} - {this.state.diedYear}
        </div>
        {this.state.works?.map((work, workindex) => (
          <div key={'work-listing-' + workindex}>
            <section className="section-header">
              {work.name} - {work?.year}
            </section>
            <div>
              <NoteList
                key={'notes-for-work' + work._id}
                index={workindex}
                viewMode={this.props.viewMode}
                getListOfNotes={this.getListOfNotes.bind(this)}
              />
            </div>
          </div>
        ))}
        <section className="section-header">Not attached to work</section>
        <NoteList
          key={'auth' + this.props.id}
          viewMode={this.props.viewMode}
          useGroupings={true}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Author
