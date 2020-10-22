import * as constants from './constants'
import * as db from './Database'
import AuthorList from './AuthorList'
import IdeaList from './IdeaList'
import NoteList from './NoteList'
import PileList from './PileList'
import React from 'react'
import WorkList from './WorkList'

class Find extends React.Component {
  state = { search: '' }

  async getListOfNotes() {
    return await db.searchNotes(this.state.search)
  }

  async getListOfWorks() {
    return await db.getSuggestions(db.types.work, this.state.search, true)
  }

  async getListOfIdeas() {
    return await db.getSuggestions(db.types.idea, this.state.search, true)
  }

  async getListOfAuthors() {
    return await db.getSuggestions(db.types.auth, this.state.search, true)
  }

  async getListOfPiles() {
    return await db.getSuggestions(db.types.pile, this.state.search, false)
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

    this.props.setPageTitle('Find: ' + search)

    return (
      <div>
        <div align="right">
          <span className="title">{search}</span>
        </div>
        <PileList
          key={'pileList' + this.state.search}
          getListOfPiles={this.getListOfPiles.bind(this)}
        />
        <AuthorList
          key={'authorList' + this.state.search}
          getListOfAuthors={this.getListOfAuthors.bind(this)}
        />
        <WorkList
          key={'workList' + this.state.search}
          getListOfWorks={this.getListOfWorks.bind(this)}
        />
        <IdeaList
          key={'ideaList' + this.state.search}
          getListOfIdeas={this.getListOfIdeas.bind(this)}
        />
        <NoteList
          key={'search-list-' + this.props.search}
          notes={notes}
          viewMode={constants.view_modes.RESULT}
          getListOfNotes={this.getListOfNotes.bind(this)}
        />
      </div>
    )
  }
}

export default Find
