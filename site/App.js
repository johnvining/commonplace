import { createNewNoteFromTitle, getAuthStatus, logout } from './Database'
import { createRoot } from 'react-dom/client'
import { Routes, Route, Link, BrowserRouter, useNavigate } from 'react-router-dom'
import plus from 'url:./icons/plus.svg'
import React, { Suspense } from 'react'
import search from 'url:./icons/search.svg'
import home_door from 'url:./icons/home_door.svg'
import axios from 'axios'
import * as constants from './constants'
import { KeyboardProvider, useKeyboardScopes, useKeyboardShortcuts, shortcuts } from './KeyboardContext'

class ErrorBoundary extends React.Component {
  state = { error: null, info: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) {
    console.error('Route error:', error, info)
    this.setState({ info })
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '32px', fontFamily: 'monospace', maxWidth: '900px' }}>
          <p><strong>Something went wrong.</strong></p>
          <p style={{ fontSize: '12px' }}>{this.state.error?.message}</p>
          <pre style={{ opacity: 0.6, fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.stack}
          </pre>
          <pre style={{ opacity: 0.6, fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.info?.componentStack}
          </pre>
          <button onClick={() => { this.setState({ error: null, info: null }); window.history.back() }}>
            Go back
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Always-visible shell components — kept eager so the chrome renders immediately
import Login from './Login'
import RecentList from './RecentList'
import SearchBar from './SearchBar'
import Sidebar from './Sidebar'
import Stats from './Stats'
import ViewSelector from './ViewSelector'
import HelpOverlay from './HelpOverlay'

// Route-specific components — lazy-loaded so they don't bloat the initial bundle
const Author      = React.lazy(() => import('./Author'))
const AuthorNotes = React.lazy(() => import('./AuthorNotes'))
const FileList    = React.lazy(() => import('./FileList'))
const FlipList    = React.lazy(() => import('./FlipList'))
const Find        = React.lazy(() => import('./Find'))
const Idea        = React.lazy(() => import('./Idea'))
const Load        = React.lazy(() => import('./Load'))
const NoteView    = React.lazy(() => import('./NoteView'))
const NickView    = React.lazy(() => import('./NickView'))
const Pile        = React.lazy(() => import('./Pile'))
const PileHome    = React.lazy(() => import('./PileHome'))
const RecentItems = React.lazy(() => import('./RecentItems'))
const Work        = React.lazy(() => import('./Work'))
const Read        = React.lazy(() => import('./Read'))
const Admin       = React.lazy(() => import('./Admin'))

class App extends React.Component {
  state = { barOpen: false, viewMode: 1, hasToken: false }

  constructor(props) {
    super(props)
    this.redirectTo = null
  }

  componentDidMount() {
    const storedViewMode = parseInt(localStorage.viewMode, 10)
    this.setState({
      viewMode: Number.isFinite(storedViewMode)
        ? storedViewMode
        : constants.view_modes.FULL,
    })
    this.validateAuth()
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

  setNewToken() {
    const redirectTo = this.redirectTo || '/'
    this.redirectTo = null
    this.setState({ authorized: true }, () => {
      this.props.navigate(redirectTo)
    })
  }

  validateAuth() {
    getAuthStatus()
      .then(() => this.setState({ authorized: true }))
      .catch(() => {
        this.redirectTo = window.location.pathname + window.location.search
        this.setState({ authorized: false })
      })
  }

  async handleLogout() {
    await logout()
    this.setState({ authorized: false })
  }

  render() {
    if (!this.state.authorized) {
      return <Login onTokenReceived={this.setNewToken.bind(this)} />
    }

    let environment = process.env.NODE_ENV
    return (
      <div className="main">
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
                className="button left-right"
                onClick={async () => {
                  this.setState({ barOpen: true })
                }}
              >
                <img src={search} />
              </button>
            </div>
            <div className="tool-bar div">
              <button
                className="button left-right"
                onClick={async () => {
                  window.location.href = '/'
                }}
              >
                <img src={home_door} />
              </button>
            </div>
            <div className="tool-bar div">
              <button
                className="button left-right"
                onClick={async () => {
                  const response = await createNewNoteFromTitle('')
                  window.location.href =
                    '/note/' + response.data._id + '/edit'
                }}
              >
                <img src={plus} />
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
        {this.state.barOpen ? (
          <div
            className="search-overlay"
            onClick={() => this.setState({ barOpen: false })}
          >
            <div
              className="search-overlay-content"
              onClick={(event) => event.stopPropagation()}
            >
              <SearchBar
                beforeNavigate={this.beforeSearchNavigate.bind(this)}
                setView={this.setView.bind(this)}
                onClose={() => this.setState({ barOpen: false })}
                onLogout={this.handleLogout.bind(this)}
              />
            </div>
          </div>
        ) : null}

        <div className="app-shell">
          <Sidebar />
          <div className="app-content">
            <ErrorBoundary>
            <Suspense fallback={null}>
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
                path="/find/:search/:category"
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
                element={<NickView setPageTitle={this.setPageTitle.bind(this)} />}
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
              <Route
                path="/recent/:type"
                element={
                  <RecentItems
                    viewMode={this.state.viewMode}
                    setPageTitle={this.setPageTitle.bind(this)}
                  />
                }
              />
              <Route
                path="/admin"
                element={<Admin setPageTitle={this.setPageTitle.bind(this)} />}
              />
            </Routes>
            </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    )
  }
}

// Wrapper component that provides keyboard context and handles global shortcuts
function AppWithKeyboard() {
  const appRef = React.useRef(null)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const activeScopes = useKeyboardScopes()
  const navigate = useNavigate()

  // Global shortcuts (Section 1 in docs)
  useKeyboardShortcuts(
    constants.keyboardScopes.GLOBAL,
    (event) => {
      // 1.1 Help Toggle (Ctrl+H) - always available
      if (shortcuts.global.toggleHelp(event)) {
        setHelpOpen((prev) => {
          const next = !prev
          console.log('[help-overlay] toggle', { open: next })
          return next
        })
        return true
      }

      // Close help with Escape
      if (helpOpen && event.keyCode === constants.keyCodes.esc) {
        setHelpOpen(false)
        return true
      }

      if (!appRef.current) return false

      const appState = appRef.current.state || {}

      // Close search bar with Escape
      if (appState.barOpen && event.keyCode === constants.keyCodes.esc) {
        appRef.current.setState({ barOpen: false })
        return true
      }

      // 1.1 Search Bar Toggle (Ctrl+O)
      if (shortcuts.global.toggleSearchBar(event)) {
        appRef.current.setState((state) => ({ barOpen: !state.barOpen }))
        return true
      }

      // 1.2 View Mode Switching
      if (shortcuts.global.viewFull(event)) {
        appRef.current.setView(constants.view_modes.FULL)
        return true
      }
      if (shortcuts.global.viewSlim(event)) {
        appRef.current.setView(constants.view_modes.SLIM)
        return true
      }
      if (shortcuts.global.viewGrid(event)) {
        appRef.current.setView(constants.view_modes.GRID)
        return true
      }
      if (shortcuts.global.viewTile(event)) {
        appRef.current.setView(constants.view_modes.TILE)
        return true
      }

      return false
    },
    [helpOpen]
  )

  // Build current context for help overlay
  const getCurrentContext = () => {
    if (!appRef.current) return {}
    const state = appRef.current.state || {}
    const hasScope = (scope) => activeScopes.has(scope)
    const noteMode = hasScope(constants.keyboardScopes.NOTE_EDIT_LINKS)
      ? constants.note_modes.EDIT_LINKS
      : hasScope(constants.keyboardScopes.NOTE_EDIT_IDEAS)
        ? constants.note_modes.EDIT_IDEAS
        : hasScope(constants.keyboardScopes.NOTE_EDIT_PILES)
          ? constants.note_modes.EDIT_PILES
          : hasScope(constants.keyboardScopes.NOTE_EDIT)
            ? constants.note_modes.EDIT
            : hasScope(constants.keyboardScopes.NOTE_SELECTED)
              ? constants.note_modes.SELECTED
              : null
    const entityPage = hasScope(constants.keyboardScopes.ENTITY_PAGE) || hasScope(constants.keyboardScopes.ENTITY_EDIT)
      ? 'Entity'
      : null
    return {
      searchBarOpen: hasScope(constants.keyboardScopes.SEARCH_BAR),
      viewMode: state.viewMode,
      entityPage,
      noteMode,
      activeScopes,
    }
  }

  return (
    <>
      <App ref={appRef} navigate={navigate} />
      <HelpOverlay
        isVisible={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentContext={getCurrentContext()}
      />
    </>
  )
}

const root = createRoot(document.getElementById('root'))
root.render(
  <BrowserRouter>
    <KeyboardProvider>
      <AppWithKeyboard />
    </KeyboardProvider>
  </BrowserRouter>,
)
