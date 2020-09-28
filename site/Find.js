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

class Find extends React.Component {
  state = { search: '' }

  componentDidMount() {
    this.fetchData(this.props.search)
  }

  componentDidUpdate(prevState) {
    if (prevState.search !== this.state.search) {
      this.fetchData(this.state.search)
    }
  }

  fetchData(search) {
    const authsFromTextSearch = getAuthorSuggestions(search)

    Promise.all([authsFromTextSearch])
      .then(response => {
        this.setState({
          authors: response[0].data.data
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  async getListOfNotes() {
    return await searchNotes(this.state.search)
  }

  async getListOfWorks() {
    return await getWorkSuggestions(this.state.search)
  }

  async getListOfIdeas() {
    return await getIdeaSuggestions(this.state.search, true)
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
          key={'workList' + this.state.search}
          getListOfIdeas={this.getListOfIdeas.bind(this)}
        />
        <br />
        Authors:
        <ul className="search-ul">
          {authors?.map(author => (
            <Link to={'/auth/' + author._id} key={'auth-link-' + author._id}>
              <li className="search-li">{author.name}</li>
            </Link>
          ))}
        </ul>
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
