import React from 'react'
import { render } from 'react-dom'
import NoteView from './NoteView'
import Author from './Author'
import { Router, Link } from '@reach/router'
import RecentList from './RecentList'
import Idea from './Idea'
import NewNote from './NewNote'
import Work from './Work'
import SearchBar from './SearchBar'

const App = () => {
  document.title = 'Commonplace'
  return (
    <div className="main">
      <div className="topBar">
        <div className="title">
          <Link to="/" className="title-link">
            <div className="title">commonplace</div>
          </Link>
        </div>
        <div className="topActions">
          <Link to="/new">
            <button className="topButton"></button>
          </Link>
        </div>
      </div>

      <br />
      <Router>
        <Author path="/auth/:id" />
        <Idea path="/idea/:id" />
        <NewNote path="/new" />
        <NoteView path="/note/:id" />
        <RecentList path="/" />
        <SearchBar path="/search" />
        <Work path="/work/:id" />
      </Router>
    </div>
  )
}

// TODO Implement a search functionality
// TODO Implement deleting
// TODO Implement adding a note
// TODO Implement book/text categorization

render(<App />, document.getElementById('root'))
