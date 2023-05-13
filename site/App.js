import { createNewNoteFromTitle } from './Database'
import { render } from 'react-dom'
import { Router, Link, navigate } from '@reach/router'
import Author from './Author'
import FileList from './FileList'
import FlipList from './FlipList'
import Find from './Find'
import Idea from './Idea'
import NoteView from './NoteView'
import Pile from './Pile'
import PileHome from './PileHome'
import plus from './icons/plus.svg'
import React from 'react'
import RecentList from './RecentList'
import search from './icons/search.svg'
import SearchBar from './SearchBar'
import ViewSelector from './ViewSelector'
import Work from './Work'

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
    } else if (event.keyCode == 27 && this.state.barOpen) {
      this.setState({ barOpen: false })
    }
  }

  beforeSearchNavigate() {
    this.setState({ barOpen: false })
  }

  setView(view) {
    this.setState({ viewMode: view })
    localStorage.viewMode = view
  }

  setPageTitle(title) {
    document.title = title
  }

  render() {
    return (
      <div className="main">
        {this.state.barOpen ? (
          <div className="top-bar">
            <SearchBar
              beforeNavigate={this.beforeSearchNavigate.bind(this)}
              setView={this.setView.bind(this)}
            />
          </div>
        ) : (
          <div className="top-bar">
            <div className="title-bar">
              <Link to="/" className="title-link">
                {process.env.NODE_ENV === 'development' ? (
                  <div className="title">DEVELOPMENT </div>
                ) : (
                  <div className="title">commonplace </div>
                )}
              </Link>
            </div>
            <div className="top-action-bar">
              <div className="tool-bar div">
                <button
                  className="standard-button left-right"
                  onClick={async () => {
                    this.setState({ barOpen: true })
                  }}
                >
                  {' '}
                  <img src={search} />{' '}
                </button>
              </div>
              <div className="tool-bar div">
                <button
                  className="standard-button left-right"
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

        <Router>
          <Author
            path="/auth/:id"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <FileList
            path="/file"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <FlipList
            path="/flip"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <Find
            path="/find/:search"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <Idea
            path="/idea/:id"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <NoteView
            path="/note/:id"
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <NoteView
            path="/nick/:nick"
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <NoteView
            path="/note/:id/edit"
            edit={true}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <Pile
            path="/pile/:id"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
            showNotes={false}
          />
          <Pile
            path="/pile/:id/notes"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
            showNotes={true}
          />
          <PileHome
            path="/piles"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <RecentList
            path="/"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
          <Work
            path="/work/:id"
            viewMode={this.state.viewMode}
            setPageTitle={this.setPageTitle.bind(this)}
          />
        </Router>
      </div>
    )
  }
}

render(<App />, document.getElementById('root'))
