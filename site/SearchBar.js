import React from 'react'
import { navigate } from '@reach/router'
import Autocomplete from './Autocomplete'
import * as db from './Database'
import * as constants from './constants'

class SearchBar extends React.Component {
  state = {
    loading: true,
    modifierSelected: false,
    modifier: '',
    typedText: ''
  }
  modifiers = {
    auth: 'auth',
    find: 'find',
    help: 'help',
    home: 'home',
    idea: 'idea',
    list: 'list',
    note: 'note',
    pile: 'pile',
    work: 'work',
    flip: 'flip',
    file: 'file',
    slim: 'slim',
    grid: 'grid',
    full: 'full'
  }
  keyEvents = {
    enter: 13,
    delete: 8
  }

  componentDidMount() {
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keyDownListener, false)
  }

  handleTextChange(event) {
    this.setState({ typedText: event.target.value }, () => {
      if (!this.state.modifier) {
        var text = this.state.typedText.toLowerCase()
        switch (text) {
          case this.modifiers.auth:
          case this.modifiers.find:
          case this.modifiers.idea:
          case this.modifiers.list:
          case this.modifiers.note:
          case this.modifiers.pile:
          case this.modifiers.work:
            this.setState({
              modifier: text,
              typedText: ''
            })
            break
        }
      }
    })
  }

  async handleKeyDown(event) {
    if (
      // Delete to go back
      event.keyCode == this.keyEvents.delete &&
      this.state.modifier &&
      this.state.typedText == '' &&
      !this.shouldShowAutocomplete()
    ) {
      var previousModifier = this.state.modifier
      this.setState({
        typedText: previousModifier + '',
        modifier: ''
      })
    } else if (
      this.state.modifier == this.modifiers.note &&
      event.keyCode == this.keyEvents.enter
    ) {
      this.setState({ modifier: '' }, async () => {
        const response = await db.createNewNoteFromTitle(this.state.typedText)
        this.props.beforeNavigate()
        navigate('/note/' + response.data._id + '/edit')
      })
    } else if (
      this.state.modifier == this.modifiers.find &&
      event.keyCode == this.keyEvents.enter
    ) {
      var search = this.state.typedText
      this.setState({ typedText: '' }, () => {
        this.props.beforeNavigate()
        navigate('/find/' + search)
      })
    } else if (
      !this.state.modifier &&
      (this.state.typedText == this.modifiers.flip ||
        this.state.typedText == this.modifiers.file ||
        this.state.typedText == this.modifiers.home) &&
      event.keyCode == this.keyEvents.enter
    ) {
      var destination = this.state.typedText
      if (this.state.typedText == this.modifiers.home) {
        destination = ''
      }
      this.setState({ typedText: '' }, () => {
        this.props.beforeNavigate()
        navigate('/' + destination)
      })
    } else if (
      this.state.modifier == this.modifiers.list &&
      this.state.typedText == this.modifiers.pile
    ) {
      this.setState({ typedText: '' }, () => {
        this.props.beforeNavigate()
        navigate('/piles')
      })
    } else if (
      (this.state.typedText == this.modifiers.slim ||
        this.state.typedText == this.modifiers.full ||
        this.state.typedText == this.modifiers.grid) &&
      event.keyCode == this.keyEvents.enter
    ) {
      var command = this.state.typedText
      this.setState({ typedText: '' }, () => {
        this.props.beforeNavigate()
        switch (command) {
          case this.modifiers.slim:
            this.props.setView(constants.view_modes.SLIM)
            break
          case this.modifiers.full:
            this.props.setView(constants.view_modes.FULL)
            break
          case this.modifiers.grid:
            this.props.setView(constants.view_modes.GRID)
            break
        }
      })
    } else if (event.keyCode == this.keyEvents.enter) {
      const nick = await db.getNick(this.state.typedText)
      if (nick) {
        // TODO: this is assuming all nicks belong to notes
        this.props.beforeNavigate()
        navigate('/note/' + nick.data.data.note)
      }
    }
  }

  handleUpdate(id) {
    switch (this.state.modifier) {
      case this.modifiers.auth:
      case this.modifiers.idea:
      case this.modifiers.work:
      case this.modifiers.pile:
        this.props.beforeNavigate()
        navigate('/' + this.state.modifier + '/' + id)
        return
    }

    return
  }

  getSuggestions(type, val) {
    var dbType = this.modifierToDbTypes(this.state.modifier)
    if (dbType) {
      return db.getSuggestions(dbType, val)
    }

    return null
  }

  async handleCreate(typedValue) {
    var dbType = this.modifierToDbTypes(this.state.modifier)
    var newRecord = await db.createRecord(dbType, typedValue)
    this.props.beforeNavigate()
    navigate('/' + dbType + '/' + newRecord.data.data._id)
  }

  modifierToDbTypes(modifier) {
    switch (modifier) {
      case this.modifiers.auth:
        return db.types.auth
      case this.modifiers.idea:
        return db.types.idea
      case this.modifiers.work:
        return db.types.work
      case this.modifiers.pile:
        return db.types.pile
    }

    return null
  }

  handleEscape() {
    this.setState({
      modifier: '',
      typedText: this.state.modifier
    })
  }

  shouldShowAutocomplete() {
    switch (this.state.modifier) {
      case this.modifiers.auth:
      case this.modifiers.idea:
      case this.modifiers.work:
      case this.modifiers.pile:
        return true
    }

    return false
  }

  render() {
    const { modifier, typedText } = this.state

    var showAutocomplete = this.shouldShowAutocomplete()

    return (
      <div className="search-bar container">
        {modifier.length ? (
          <div className="search-bar current-modifier">{modifier}</div>
        ) : null}

        {showAutocomplete ? (
          <Autocomplete
            inputName="searchBar"
            className="search-bar"
            defaultValue={typedText || ''}
            onSelect={this.handleUpdate.bind(this)}
            getSuggestions={this.getSuggestions.bind(this)}
            handleNewSelect={this.handleCreate.bind(this)}
            escape={this.handleEscape.bind(this)}
          />
        ) : (
          <input
            className="search-bar search-box"
            autoFocus
            value={typedText}
            onChange={this.handleTextChange.bind(this)}
          ></input>
        )}
      </div>
    )
  }
}

export default SearchBar
