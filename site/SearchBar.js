import React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Autocomplete from './Autocomplete'
import * as db from './Database'
import * as constants from './constants'

function SearchBar(props) {
  const [modifier, setModifier] = useState('')
  const [typedText, setTypedText] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const onKeyDown = async (event) => {
      if (
        // Delete to go back
        event.keyCode == constants.keyEvents.delete &&
        modifier &&
        typedText == '' &&
        !shouldShowAutocomplete()
      ) {
        var previousModifier = modifier
        setTypedText(previousModifier + '')
        setModifier('')
      } else if (
        // Create new note
        modifier == constants.modifiers.note &&
        event.keyCode == constants.keyEvents.enter
      ) {
        setModifier('')
        const response = await db.createNewNoteFromTitle(typedText)
        props.beforeNavigate()
        navigate('/note/' + response.data._id + '/edit')
      } else if (
        modifier == constants.modifiers.find &&
        event.keyCode == constants.keyEvents.enter
      ) {
        var search = typedText
        setTypedText('')
        props.beforeNavigate()
        navigate('/find/' + search)
      } else if (
        !modifier &&
        (typedText == constants.modifiers.flip ||
          typedText == constants.modifiers.file ||
          typedText == constants.modifiers.home) &&
        event.keyCode == constants.keyEvents.enter
      ) {
        var destination = typedText
        if (typedText == constants.modifiers.home) {
          destination = ''
        }
        setTypedText('')
        props.beforeNavigate()
        navigate('/' + destination)
      } else if (
        modifier == constants.modifiers.list &&
        typedText == constants.modifiers.pile
      ) {
        setTypedText('')
        props.beforeNavigate()
        navigate('/piles')
      } else if (
        (typedText == constants.modifiers.slim ||
          typedText == constants.modifiers.full ||
          typedText == constants.modifiers.grid) &&
        event.keyCode == constants.keyEvents.enter
      ) {
        var command = typedText
        setTypedText('')

        props.beforeNavigate()
        switch (command) {
          case constants.modifiers.slim:
            props.setView(constants.view_modes.SLIM)
            break
          case constants.modifiers.full:
            props.setView(constants.view_modes.FULL)
            break
          case constants.modifiers.grid:
            props.setView(constants.view_modes.GRID)
            break
        }
      } else if (event.keyCode == constants.keyEvents.enter) {
        const nick = await db.getNick(typedText)
        if (nick) {
          // TODO: this is assuming all nicks belong to notes
          props.beforeNavigate()
          navigate('/note/' + nick.data.data.note)
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  const handleTextChange = (input) => {
    setTypedText(input.target.value)
    if (!modifier) {
      var text = input.target.value
      switch (text) {
        case constants.modifiers.auth:
        case constants.modifiers.find:
        case constants.modifiers.idea:
        case constants.modifiers.list:
        case constants.modifiers.note:
        case constants.modifiers.pile:
        case constants.modifiers.work:
          setModifier(text)
          setTypedText('')
          break
      }
    }
  }

  const handleUpdate = (id) => {
    switch (modifier) {
      case constants.modifiers.auth:
      case constants.modifiers.idea:
      case constants.modifiers.work:
      case constants.modifiers.pile:
        props.beforeNavigate()
        navigate('/' + modifier + '/' + id)
        return
    }

    return
  }

  const getSuggestions = (type, val) => {
    var dbType = modifierToDbTypes(modifier)
    if (dbType) {
      return db.getSuggestions(dbType, val)
    }

    return null
  }

  const handleCreate = async (typedValue) => {
    var dbType = modifierToDbTypes(modifier)
    var newRecord = await db.createRecord(dbType, typedValue)
    props.beforeNavigate()
    navigate('/' + dbType + '/' + newRecord.data.data._id)
  }

  const modifierToDbTypes = (modifier) => {
    switch (modifier) {
      case constants.modifiers.auth:
        return db.types.auth
      case constants.modifiers.idea:
        return db.types.idea
      case constants.modifiers.work:
        return db.types.work
      case constants.modifiers.pile:
        return db.types.pile
    }

    return null
  }

  const handleEscape = () => {
    setTypedText(modifier)
    setModifier('')
  }

  const shouldShowAutocomplete = () => {
    switch (modifier) {
      case constants.modifiers.auth:
      case constants.modifiers.idea:
      case constants.modifiers.work:
      case constants.modifiers.pile:
        return true
    }

    return false
  }

  var showAutocomplete = shouldShowAutocomplete()
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
          onSelect={handleUpdate}
          getSuggestions={getSuggestions}
          handleNewSelect={handleCreate}
          escape={handleEscape}
        />
      ) : (
        <input
          className="search-bar search-box"
          autoFocus
          value={typedText}
          onChange={(event) => handleTextChange(event)}
        ></input>
      )}
    </div>
  )
}

export default SearchBar
