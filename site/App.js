import React from 'react'
import { render } from 'react-dom'
import NoteView from './NoteView'
import Author from './Author'
import { Router, Link } from '@reach/router'
import RecentList from './RecentList'
import Idea from './Idea'
import NewNote from './NewNote'

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
        <NewNote path="/new" />
        <RecentList path="/" />
        <Idea path="/idea/:id" />
        <NoteView path="/note/:id" />
        <Author path="/auth/:id" />
      </Router>
    </div>
  )
}

// TODO Implement a search functionality
// TODO Implement deleting
// TODO Implement adding a note
// TODO Implement book/text categorization

render(<App />, document.getElementById('root'))
