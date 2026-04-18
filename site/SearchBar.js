import React from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Autocomplete from './Autocomplete'
import * as db from './Database'
import * as constants from './constants'
import { useKeyboardShortcuts, shortcuts } from './KeyboardContext'

function SearchBar(props) {
  const [modifier, setModifier] = useState('')
  const [typedText, setTypedText] = useState('')
  const [searchError, setSearchError] = useState('')
  const navigate = useNavigate()

  const handleExecute = async () => {
    const currentModifier = modifier
    const currentText = typedText
    const normalizedText = (currentText || '').trim().toLowerCase()

    // Create new note
    if (currentModifier === constants.modifiers.note) {
      setModifier('')
      try {
        const response = await db.createNewNoteFromTitle(currentText)
        const noteId = response?.data?._id
        if (!noteId) {
          console.error('Create note response missing id', response)
          return
        }
        props.beforeNavigate()
        navigate('/note/' + noteId + '/edit')
      } catch (error) {
        console.error('Error creating note', error)
      }
      return
    }

    // Find/search
    if (currentModifier === constants.modifiers.find) {
      const search = currentText
      setTypedText('')
      props.beforeNavigate()
      navigate('/find/' + search)
      return
    }

    // Direct navigation commands
    if (
      !currentModifier &&
      [constants.modifiers.flip, constants.modifiers.file, constants.modifiers.home, constants.modifiers.load].includes(currentText)
    ) {
      let destination = currentText
      if (currentText === constants.modifiers.home) {
        destination = ''
      }
      setTypedText('')
      props.beforeNavigate()
      navigate('/' + destination)
      return
    }

    // List piles
    if (currentModifier === constants.modifiers.list && (normalizedText === constants.modifiers.pile || normalizedText === 'piles')) {
      setTypedText('')
      props.beforeNavigate()
      navigate('/piles')
      return
    }

    // View mode commands
    if ([constants.modifiers.slim, constants.modifiers.full, constants.modifiers.grid, constants.modifiers.tile].includes(currentText)) {
      const command = currentText
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
        case constants.modifiers.tile:
          props.setView(constants.view_modes.TILE)
          break
      }
      return
    }

    // Entity navigation by name
    if (
      [
        constants.modifiers.auth,
        constants.modifiers.idea,
        constants.modifiers.work,
        constants.modifiers.pile,
        constants.modifiers.read,
      ].includes(currentModifier)
    ) {
      if (!currentText) {
        return
      }
      const dbType = modifierToDbTypes(currentModifier)
      if (!dbType) {
        return
      }
      try {
        const response = await db.getSuggestions(dbType, currentText)
        const options = response?.data?.data || []
        if (!options.length) {
          return
        }
        const normalized = currentText.trim().toLowerCase()
        const exactMatch =
          options.find((item) => item?.name?.toLowerCase() === normalized) ||
          options[0]
        const id = exactMatch?._id || exactMatch?.id
        if (!id) {
          return
        }
        props.beforeNavigate()
        navigate('/' + currentModifier + '/' + id)
        return
      } catch (error) {
        console.error('Error fetching suggestions', error)
        return
      }
    }

    if (!currentText) {
      return
    }

    // Nick lookup
    try {
      const nickResponse = await db.getNick(currentText)
      const nickData = nickResponse?.data?.data
      if (!nickData) {
        setSearchError('Nick not found')
        return
      }
      props.beforeNavigate()
      switch (nickData.key?.charAt(0)) {
        case 'n':
          navigate('/note/' + nickData.note)
          return
        case 'w':
          navigate('/work/' + nickData.work)
          return
        case 'i':
          navigate('/idea/' + nickData.idea)
          return
        case 'p':
          navigate('/pile/' + nickData.pile)
          return
        default:
          setSearchError('Nick not found')
      }
    } catch (error) {
      console.error('Error fetching nick', error)
      setSearchError('Nick not found')
    }
  }

  // Section 2: Search Bar keyboard shortcuts
  useKeyboardShortcuts(
    constants.keyboardScopes.SEARCH_BAR,
    (event) => {
      const target = event.target
      const isAutocompleteOption = target?.tagName === 'BUTTON' &&
        target?.classList?.contains('option')

      // Section 2.1: Navigation - Backspace to go back
      if (
        shortcuts.searchBar.back(event) &&
        modifier &&
        typedText === '' &&
        !shouldShowAutocomplete()
      ) {
        setTypedText(modifier)
        setModifier('')
        return true
      }

      // Close search bar with Escape
      if (shortcuts.searchBar.close(event)) {
        if (props.onClose) props.onClose()
        return true
      }

      // Section 2.2: Execution - Enter to execute
      if (shortcuts.searchBar.execute(event) && !isAutocompleteOption) {
        void handleExecute()
        return true
      }

      return false
    },
    [modifier, typedText]
  )

  const handleTextChange = (input) => {
    setSearchError('')
    setTypedText(input.target.value)
    if (!modifier) {
      var text = input.target.value.toLowerCase()
      switch (text) {
        case constants.modifiers.auth:
        case constants.modifiers.find:
        case constants.modifiers.idea:
        case constants.modifiers.list:
        case constants.modifiers.note:
        case constants.modifiers.pile:
        case constants.modifiers.work:
        case constants.modifiers.read:
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
      case constants.modifiers.read:
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
    try {
      var newRecord = await db.createRecord(dbType, typedValue)
      const newId = newRecord?.data?.data?._id
      if (!newId) {
        console.error('Create record response missing id', newRecord)
        return
      }
      props.beforeNavigate()
      navigate('/' + dbType + '/' + newId)
    } catch (error) {
      console.error('Error creating record', error)
    }
  }

  const modifierToDbTypes = (modifier) => {
    switch (modifier) {
      case constants.modifiers.auth:
        return db.types.auth
      case constants.modifiers.idea:
        return db.types.idea
      case constants.modifiers.work:
      case constants.modifiers.read:
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
      case constants.modifiers.read:
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
      {searchError && <div className="search-bar-error">{searchError}</div>}

      {showAutocomplete ? (
        <Autocomplete
          inputName="searchBar"
          className="search-bar"
          defaultValue={typedText || ''}
          onSelect={handleUpdate}
          getSuggestions={getSuggestions}
          handleNewSelect={handleCreate}
          escape={handleEscape}
          onClose={props.onClose}
        />
      ) : (
        <input
          className="search-bar search-box"
          data-allow-shortcuts="true"
          autoFocus
          value={typedText}
          onChange={(event) => handleTextChange(event)}
        ></input>
      )}
    </div>
  )
}

export default SearchBar
