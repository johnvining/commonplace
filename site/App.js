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
import Find from './Find'

class App extends React.Component {
  state = { barOpen: false, slim: true }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)
  }

  componentWillUnmount() {
    document.removeEventListener(
      'keydown',
      this.handleKeyDown.bind(this),
      false
    )
  }

  handleKeyDown(event) {
    if (event.ctrlKey && event.keyCode == 79) {
      this.setState({ barOpen: !this.state.barOpen })
    }
  }

  beforeSearchNavigate() {
    this.setState({ barOpen: false })
  }

  toggleSlim() {
    this.setState({ slim: !this.state.slim })
  }

  render() {
    return (
      <div className="main">
        {this.state.barOpen ? (
          <div className="topBar">
            <SearchBar
              beforeNavigate={this.beforeSearchNavigate.bind(this)}
              toggleSlim={this.toggleSlim.bind(this)}
            />
          </div>
        ) : (
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
        )}
        <br />
        <Router>
          <Author path="/auth/:id" slim={this.state.slim} />
          <Find path="/find/:search" />
          <Idea path="/idea/:id" slim={this.state.slim} />
          <NewNote path="/new" />
          <NoteView path="/note/:id" />
          <RecentList path="/" slim={this.state.slim} />
          <Work path="/work/:id" slim={this.state.slim} />
        </Router>
      </div>
    )
  }
}

// TODO Implement a search functionality
// TODO Implement deleting
// TODO Implement adding a note
// TODO Implement book/text categorization

render(<App />, document.getElementById('root'))
