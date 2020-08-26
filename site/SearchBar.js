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
    work: 'work',
    idea: 'idea',
    find: 'find',
    note: 'note'
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
          case this.modifiers.note:
            this.setState({
              modifier: text,
              modifierSelected: true,
              typedText: ''
            })
            break
          default:
        }
      }
    })
  }

  handleKeyDown(event) {
    if (
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
    }
  }

  handleUpdate(id, name) {
    console.log('handle update')
    console.log(this.state.modifier)
    switch (this.state.modifier) {
      case this.modifiers.auth:
        navigate('/auth/' + id)
        return
      case this.modifiers.idea:
        navigate('/idea/' + id)
        return
      case this.modifiers.work:
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
    return (
      <div className="searchBar-container">
        {this.state.modifier.length ? (
          <div className="currentModifier">{this.state.modifier}</div>
        ) : null}

        {this.state.modifier.length ? (
          <Autocomplete
            className={'searchBar'}
            defaultValue={this.state.typedText}
            onSelect={this.handleUpdate.bind(this)}
            getSuggestions={this.getSuggestions.bind(this)}
            handleNewSelect={this.handleCreate.bind(this)}
          />
        ) : (
          <input
            className="searchBar"
            value={this.state.typedText}
            onChange={this.handleTextChange.bind(this)}
          ></input>
        )}
      </div>
    )
  }
}

export default SearchBar
