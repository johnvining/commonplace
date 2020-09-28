import React from 'react'
import NoteList from './NoteList'
import {
  searchNotes,
  getIdeaSuggestions,
  getWorkSuggestions,
  getAuthorSuggestions
} from './Database'
import { Link } from '@reach/router'
import WorkList from './WorkList'
import IdeaList from './IdeaList'
import AuthorList from './AuthorList'

class Find extends React.Component {
  state = { search: '' }

  async getListOfNotes() {
    return await searchNotes(this.state.search)
  }

  async getListOfWorks() {
    return await getWorkSuggestions(this.state.search)
  }

  async getListOfIdeas() {
    return await getIdeaSuggestions(this.state.search, true)
  }

  async getListOfAuthors() {
    return await getAuthorSuggestions(this.state.search)
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.search !== prevState.search) {
      return { search: nextProps.search }
    }

    return null
  }

  render() {
    const { notes, ideas, works, authors } = this.state
    const { search } = this.props

    return (
      <div>
        <div align="right">
          <span className="title">{search}</span>
        </div>
        Works:
        <WorkList
          key={'workList' + this.state.search}
          getListOfWorks={this.getListOfWorks.bind(this)}
        />
        Ideas:
        <IdeaList
          key={'ideaList' + this.state.search}
          getListOfIdeas={this.getListOfIdeas.bind(this)}
        />
        <br />
        Authors:
        <AuthorList
          key={'authorList' + this.state.search}
          getListOfAuthors={this.getListOfAuthors.bind(this)}
        />
        <br />
        Notes:
        <NoteList
          key={'search-list-' + this.props.search}
          notes={notes}
          viewMode={this.props.viewMode}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Find
