import React from 'react'
import { render } from 'react-dom'
import { Router, Link } from '@reach/router'
import Author from './Author'
import Find from './Find'
import Idea from './Idea'
import ImageUploader from './ImageUploader'
import NoteView from './NoteView'
import RecentList from './RecentList'
import SearchBar from './SearchBar'
import ViewSelector from './ViewSelector'
import Work from './Work'

class App extends React.Component {
  state = { barOpen: false, viewMode: 1 }

  componentDidMount() {
    this.setState({ viewMode: localStorage.viewMode })
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

  setView(view) {
    this.setState({ viewMode: view })
    localStorage.viewMode = view
  }

  render() {
    return (
      <div className="main">
        {this.state.barOpen ? (
          <div className="top-bar">
            <SearchBar
              beforeNavigate={this.beforeSearchNavigate.bind(this)}
              toggleSlim={this.toggleSlim.bind(this)}
            />
          </div>
        ) : (
          <div className="top-bar">
            <div className="title">
              <Link to="/" className="title-link">
                <div className="title">commonplace</div>
              </Link>
            </div>
            <div className="top-action-bar">
              <ViewSelector
                viewMode={this.state.viewMode}
                setView={this.setView.bind(this)}
              />
            </div>
          </div>
        )}

        <br />
        <Router>
          <Author path="/auth/:id" viewMode={this.state.viewMode} />
          <Find path="/find/:search" viewMode={this.state.viewMode} />
          <Idea path="/idea/:id" viewMode={this.state.viewMode} />
          <NoteView path="/note/:id" />
          <RecentList path="/" viewMode={this.state.viewMode} />
          <Work path="/work/:id" viewMode={this.state.viewMode} />
          <ImageUploader path="/test" />
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
