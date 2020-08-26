import React from 'react'
import { navigate } from '@reach/router'
import Autocomplete from './Autocomplete'
import * as db from './Database'
import { realpathSync } from 'fs'

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
    work: 'work'
  }

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

  handleTextChange(event) {
    this.setState({ typedText: event.target.value }, () => {
      if (!this.state.modifierSelected) {
        let text = this.state.typedText
        switch (text) {
          case this.modifiers.auth:
          case this.modifiers.work:
          case this.modifiers.idea:
          case this.modifiers.find:
            this.setState({
              modifier: text,
              modifierSelected: true,
              typedText: ''
            })
            break
          case this.modifiers.note:
            this.setState({
              modifier: text,
              modifierSelected: true,
              typedText: ''
            })
            break
        }
      }
    })
  }

  // TODO: Does async make sense here?
  async handleKeyDown(event) {
    if (
      //Delete to go back
      // FIXME: Bug where there is already text
      event.keyCode == 8 &&
      this.state.modifierSelected &&
      this.state.typedText == ''
    ) {
      let previousModifier = this.state.modifier
      this.setState({
        typedText: previousModifier + '',
        modifier: '',
        modifierSelected: false
      })
      // TODO: Set focus back on the input
    } else if (
      this.state.modifier == this.modifiers.note &&
      event.keyCode == 13
    ) {
      const response = await db.createNewNoteFromTitle(this.state.typedText)
      this.props.beforeNavigate()
      navigate('/note/' + response.data._id)
    }
  }

  handleUpdate(id, name) {
    console.log('handle update')
    console.log(this.state.modifier)
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
    }

    return
  }

  getSuggestions(val) {
    switch (this.state.modifier) {
      case this.modifiers.auth:
        return db.getAuthorSuggestions(val)
      case this.modifiers.idea:
        return db.getIdeaSuggestions(val)
      case this.modifiers.work:
        return db.getWorkSuggestions(val)
    }

    return null
  }

  handleCreate() {}

  render() {
    const { modifier, typedText } = this.state

    let showAutocomplete = false
    switch (modifier) {
      case this.modifiers.auth:
      case this.modifiers.idea:
      case this.modifiers.work:
        showAutocomplete = true
        break
    }

    return (
      <div className="searchBar-container">
        {modifier.length ? (
          <div className="currentModifier">{modifier}</div>
        ) : null}

        {showAutocomplete ? (
          <Autocomplete
            className={'searchBar'}
            defaultValue={typedText}
            onSelect={this.handleUpdate.bind(this)}
            getSuggestions={this.getSuggestions.bind(this)}
            handleNewSelect={this.handleCreate.bind(this)}
          />
        ) : (
          <input
            className="searchBar"
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
