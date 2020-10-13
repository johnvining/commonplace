import React from 'react'
import { render } from 'react-dom'
import { Router, Link, navigate } from '@reach/router'
import Author from './Author'
import Find from './Find'
import Idea from './Idea'
import NoteView from './NoteView'
import Pile from './Pile'
import RecentList from './RecentList'
import SearchBar from './SearchBar'
import ViewSelector from './ViewSelector'
import Work from './Work'
import plus from './icons/plus.svg'
import { createNewNoteFromTitle } from './Database'

class App extends React.Component {
  state = { barOpen: false, viewMode: 1 }

  componentDidMount() {
    this.setState({ viewMode: localStorage.viewMode })
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keyDownListener, false)
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
                {process.env.NODE_ENV === 'development' ? (
                  <div className="title">common-dev </div>
                ) : (
                  <div className="title">commonplace </div>
                )}
              </Link>
            </div>
            <div className="top-action-bar">
              <div className="tool-bar div">
                <button
                  className="button left-right"
                  onClick={async () => {
                    const response = await createNewNoteFromTitle('')
                    navigate('/note/' + response.data._id + '/edit')
                  }}
                >
                  {' '}
                  <img src={plus} />{' '}
                </button>
              </div>
              <div className="tool-bar div">
                <ViewSelector
                  viewMode={this.state.viewMode}
                  setView={this.setView.bind(this)}
                />
              </div>
            </div>
          </div>
        )}

        <br />
        <Router>
          <Author path="/auth/:id" viewMode={this.state.viewMode} />
          <Find path="/find/:search" viewMode={this.state.viewMode} />
          <Idea path="/idea/:id" viewMode={this.state.viewMode} />
          <NoteView path="/note/:id" />
          <NoteView path="/note/:id/edit" edit={true} />
          <Pile path="/pile/:id" viewMode={this.state.viewMode} />
          <RecentList path="/" viewMode={this.state.viewMode} />
          <Work path="/work/:id" viewMode={this.state.viewMode} />
        </Router>
      </div>
    )
  }
}

render(<App />, document.getElementById('root'))
