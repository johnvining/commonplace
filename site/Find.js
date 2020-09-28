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
    const ideasFromTextSearch = getIdeaSuggestions(search, true)
    const authsFromTextSearch = getAuthorSuggestions(search)

    Promise.all([ideasFromTextSearch, authsFromTextSearch])
      .then(response => {
        this.setState({
          ideas: response[0].data.data,
          authors: response[1].data.data
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
          key={'workList' + this.props.id}
          getListOfWorks={this.getListOfWorks.bind(this)}
        ></WorkList>
        Ideas:
        <ul className="search-ul">
          {ideas?.map(idea => (
            <div key={'idea-div-' + idea._id}>
              <Link to={'/idea/' + idea._id}>
                <li className="search-li">{idea.name}</li>
              </Link>

              <div>
                {idea.notes?.length}:
                {idea.notes?.map(note => note.title + '. ')}
              </div>
            </div>
          ))}
        </ul>
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
