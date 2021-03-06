import React from 'react'
import { navigate } from '@reach/router'
import Autocomplete from './Autocomplete'
import * as db from './Database'

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
    note: 'note',
    pile: 'pile',
    work: 'work',
    slim: 'slim'
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
        var text = this.state.typedText
        switch (text) {
          case this.modifiers.auth:
          case this.modifiers.work:
          case this.modifiers.idea:
          case this.modifiers.find:
          case this.modifiers.note:
          case this.modifiers.pile:
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
      event.keyCode == 8 &&
      this.state.modifier &&
      this.state.typedText == '' &&
      !this.shouldShowAutocomplete()
    ) {
      var previousModifier = this.state.modifier
      this.setState({
        typedText: previousModifier + '',
        modifier: ''
      })
      // TODO: Set focus back on the input
    } else if (
      this.state.modifier == this.modifiers.note &&
      event.keyCode == 13
    ) {
      this.setState({ modifier: '' }, async () => {
        const response = await db.createNewNoteFromTitle(this.state.typedText)
        this.props.beforeNavigate()
        navigate('/note/' + response.data._id + '/edit')
      })
    } else if (
      !this.state.modifier &&
      this.state.typedText == this.modifiers.home &&
      event.keyCode == 13
    ) {
      this.props.beforeNavigate()
      navigate('/')
    } else if (
      !this.state.modifier &&
      this.state.typedText == this.modifiers.slim &&
      event.keyCode == 13
    ) {
      this.setState({ typedText: '' }, () => {
        this.props.toggleSlim()
        this.props.beforeNavigate()
      })
    } else if (
      this.state.modifier == this.modifiers.find &&
      event.keyCode == 13
    ) {
      var search = this.state.typedText
      this.setState({ typedText: '' }, () => {
        this.props.beforeNavigate()
        navigate('/find/' + search)
      })
    }
  }

  handleUpdate(id, name) {
    switch (this.state.modifier) {
      case this.modifiers.auth:
        this.props.beforeNavigate()
        navigate('/auth/' + id)
        return
      case this.modifiers.idea:
        this.props.beforeNavigate()
        navigate('/idea/' + id)
        return
      case this.modifiers.work:
        this.props.beforeNavigate()
        navigate('/work/' + id)
        return
      case this.modifiers.pile:
        this.props.beforeNavigate()
        navigate('/pile/' + id)
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
            className="search-bar label"
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
