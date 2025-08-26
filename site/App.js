import { createNewNoteFromTitle } from './Database'
import { createRoot } from 'react-dom/client'
import { Routes, Route, Link, BrowserRouter } from 'react-router-dom'
import Author from './Author'
import AuthorNotes from './AuthorNotes'
import FileList from './FileList'
import FlipList from './FlipList'
import Find from './Find'
import Idea from './Idea'
import Login from './Login'
import Load from './Load'
import NoteView from './NoteView'
import Pile from './Pile'
import PileHome from './PileHome'
import plus from './icons/plus.svg'
import React from 'react'
import RecentList from './RecentList'
import search from './icons/search.svg'
import home_door from './icons/home_door.svg'
import SearchBar from './SearchBar'
import Stats from './Stats'
import ViewSelector from './ViewSelector'
import Work from './Work'
import Read from './Read'
import jwt from 'jsonwebtoken'
import axios from 'axios'
import * as constants from './constants'

class App extends React.Component {
  state = { barOpen: false, viewMode: 1, hasToken: false }

  constructor(props) {
    super(props)
    axios.defaults.headers.common['Authorization'] =
      localStorage.getItem('token')
  }

  componentDidMount() {
    this.setState({ viewMode: localStorage.viewMode })
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)
    this.validateAuth()
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keyDownListener, false)
  }

  handleKeyDown(event) {
    if (event.ctrlKey && event.keyCode == constants.keyCodes.open) {
      this.setState({ barOpen: !this.state.barOpen })
    } else if (event.keyCode == constants.keyCodes.esc && this.state.barOpen) {
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

  setNewToken(token) {
    if (!token || token == 'null' || this.tokenIsExpired(token)) {
      this.setState({ authorized: false })
    } else {
      axios.defaults.headers.common['Authorization'] = `${token}`
      this.setState({ authorized: true }, () => {
        localStorage.setItem('token', token)
      })
    }
  }

  validateAuth() {
    let token = localStorage.getItem('token')
    if (!token || token == 'null' || this.tokenIsExpired(token)) {
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['Authorization']
      this.setState({ authorized: false }, () => {
        return false
      })
    } else {
      axios.defaults.headers.common['Authorization'] = `${token}`
      this.setState({ authorized: true }, () => {
        return true
      })
    }
  }

  tokenIsExpired(token) {
    if (!token || token == null || token == 'null') {
      return true
    }
    var decodedToken = jwt.decode(token, { complete: true })
    var dateNow = new Date()

    if (decodedToken) {
      return decodedToken.payload.exp * 1000 < dateNow.getTime()
    } else {
      return false
    }
  }

  render() {
    if (!this.state.authorized) {
      return <Login onTokenReceived={this.setNewToken.bind(this)} />
    }

    let environment = process.env.NODE_ENV
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
                {environment === 'development' ? (
                  <div className="title">DEVELOPMENT </div>
                ) : (
                  <div className="title">commonplace </div>
                )}
              </Link>
            </div>
            <div className="stats-center">
              <Stats />
            </div>
            <div className="top-action-bar">
              <div className="tool-bar div">
                <button
                  className="standard-button left-right"
                  onClick={async () => {
                    this.setState({ barOpen: true })
                  }}
                >
                  <img src={search} />{' '}
                </button>
              </div>
              <div className="tool-bar div">
                <button
                  className="standard-button left-right"
                  onClick={async () => {
                    window.location.href = '/'
                  }}
                >
                  <img src={home_door} />{' '}
                </button>
              </div>
              <div className="tool-bar div">
                <button
                  className="standard-button left-right"
                  onClick={async () => {
                    const response = await createNewNoteFromTitle('')
                    window.location.href =
                      '/note/' + response.data._id + '/edit'
                  }}
                >
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

        <Routes>
          <Route
            path="/auth/:id"
            element={
              <Author
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/auth/:id/notes"
            element={
              <AuthorNotes
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/file"
            element={
              <FileList
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/flip"
            element={
              <FlipList
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/load"
            element={<Load setPageTitle={this.setPageTitle.bind(this)} />}
          />
          <Route
            path="/find/:search"
            element={
              <Find
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/idea/:id"
            element={
              <Idea
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/note/:id"
            element={<NoteView setPageTitle={this.setPageTitle.bind(this)} />}
          />
          <Route
            path="/nick/:nick"
            element={<NoteView setPageTitle={this.setPageTitle.bind(this)} />}
          />
          <Route
            path="/note/:id/edit"
            element={
              <NoteView
                edit={true}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/pile/:id"
            element={
              <Pile
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
                showNotes={false}
              />
            }
          />
          <Route
            path="/pile/:id/notes"
            element={
              <Pile
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
                showNotes={true}
              />
            }
          />
          <Route
            path="/piles"
            element={
              <PileHome
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/"
            element={
              <RecentList
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/work/:id"
            element={
              <Work
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
          <Route
            path="/read/:id"
            element={
              <Read
                viewMode={this.state.viewMode}
                setPageTitle={this.setPageTitle.bind(this)}
              />
            }
          />
        </Routes>
      </div>
    )
  }
}

const root = createRoot(document.getElementById('root'))
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
