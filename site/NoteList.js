import React from 'react'
import Note from './Note'
import NoteSlim from './NoteSlim'
import NoteGrid from './NoteGrid'
import NoteTile from './NoteTile'
import NoteResult from './NoteResult'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import * as constants from './constants'
import left from 'url:./icons/left.svg'
import right from 'url:./icons/right.svg'
import autosize from 'autosize'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'
import { useKeyboardShortcuts, shortcuts } from './KeyboardContext'

class NoteList extends React.Component {
  state = {
    inFocus: null,
    focusType: constants.note_modes.NO_SELECTION,
    selectedNote: '',
    notes: undefined,
    selectedArray: [],
    deleted: [],
    anchorIndex: 0,
    lastTouchedIndex: 0,
    useGridView: 1,
    page: 1,
    pageLoading: false,
  }

  getActiveNoteId(event) {
    const target = event?.target || document.activeElement
    if (!target || typeof target.closest !== 'function') return null
    const noteElement = target.closest('[data-note-id]')
    return noteElement?.dataset?.noteId || null
  }

  async componentDidMount() {
    const response = await this.props.getListOfNotes(
      this.props.index,
      this.state.page
    )

    const notes = this.props.reverse
      ? response.data.data.reverse()
      : response.data.data

    this.setState(
      {
        notes: notes,
      },
      () => {
        this.setupImageObserver()
        this.clearSelection()
        this.focusFirstNote()

        const firstNoteId = this.state.notes?.[0]?._id
        if (!firstNoteId) {
          return
        }

        if (this.props.editFirst) {
          this.setNoteMode(firstNoteId, constants.note_modes.EDIT)
          autosize(document.querySelector('#text'))
          autosize(document.querySelector('#take'))
          return
        }

        if (this.props.fromNoteView) {
          this.setNoteMode(firstNoteId, constants.note_modes.SELECTED)
        }
      }
    )
  }

  // Section 4: Note List keyboard shortcuts - called from wrapper
  handleKeyboardShortcut(event) {
    // Only handle shortcuts in Full view mode
    if (this.props.viewMode !== constants.view_modes.FULL) {
      return false
    }

    if (
      [
        constants.note_modes.EDIT,
        constants.note_modes.EDIT_IDEAS,
        constants.note_modes.EDIT_PILES,
        constants.note_modes.EDIT_LINKS,
      ].includes(this.state.focusType)
    ) {
      return false
    }

    // Section 4.2: Quick Edit shortcuts (Ctrl+key)
    if (event.ctrlKey) {
      if (
        this.state.focusType !== constants.note_modes.SELECTED ||
        !this.state.selectedNote
      ) {
        return false
      }

      const activeNoteId = this.state.selectedNote
      switch (event.keyCode) {
        case constants.keyCodes.edit:
          this.setNoteMode(activeNoteId, constants.note_modes.EDIT)
          autosize(document.querySelector('#text'))
          autosize(document.querySelector('#take'))
          return true
        case constants.keyCodes.ideas:
          this.setNoteMode(activeNoteId, constants.note_modes.EDIT_IDEAS)
          return true
        case constants.keyCodes.piles:
          this.setNoteMode(activeNoteId, constants.note_modes.EDIT_PILES)
          return true
      }
    }

    // Section 4.1: Selection shortcuts
    if (shortcuts.noteList.select(event)) {
      let activeNoteId = this.getActiveNoteId(event) || this.state.selectedNote
      if (!activeNoteId && this.state.notes?.length) {
        activeNoteId = this.state.notes[0]._id
      }
      if (activeNoteId) {
        this.setNoteMode(activeNoteId, constants.note_modes.SELECTED)
        return true
      }
    }

    if (shortcuts.noteList.deselect(event)) {
      if (this.state.selectedNote) {
        var divToFocus = document.getElementById(this.state.selectedNote)
        if (divToFocus) divToFocus.focus()
      }
      this.setNoteMode('', constants.note_modes.NO_SELECTION)
      this.setState({ selectedArray: [] })
      return true
    }

    return false
  }

  async incPage() {
    this.setState({ pageLoading: true })
    const response = await this.props.getListOfNotes(
      this.props.index,
      this.state.page + 1
    )
    window.scrollTo({ top: 0, behavior: 'instant' })
    this.setState(
      {
        notes: response.data.data,
        page: this.state.page + 1,
        selectedArray: [],
        selectedNote: '',
        focusType: constants.note_modes.NO_SELECTION,
        pageLoading: false,
      },
      () => this.setupImageObserver()
    )
    this.focusFirstNote()
  }

  async decPage() {
    this.setState({ pageLoading: true })
    const response = await this.props.getListOfNotes(
      this.props.index,
      this.state.page - 1
    )
    window.scrollTo({ top: 0, behavior: 'instant' })
    this.setState(
      {
        notes: response.data.data,
        page: this.state.page - 1,
        selectedArray: [],
        selectedNote: '',
        focusType: constants.note_modes.NO_SELECTION,
        pageLoading: false,
      },
      () => this.setupImageObserver()
    )
    this.focusFirstNote()
  }

  focusFirstNote() {
    const firstNoteId = this.state.notes?.[0]?._id
    if (!firstNoteId) {
      return
    }
    requestAnimationFrame(() => {
      const element = document.getElementById(firstNoteId)
      if (element) {
        element.focus()
      }
    })
  }

  async refetchNoteAtIndex(index) {
    var notes = this.state.notes
    const response = await db.getInfo(db.types.note, notes[index]._id)
    var note = response.data.data[0]
    note.imageUrls = this.state.notes[index].imageUrls
    notes[index] = note
    this.setState({ notes: notes })

    if (this.props.fromNoteView) {
      this.props.setPageTitle(notes[0].title)
    }
  }

  setupImageObserver() {
    if (this._imageObserver) {
      this._imageObserver.disconnect()
    }
    this._imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.dataset.noteIndex, 10)
            if (!isNaN(index)) {
              this.getImagesForNoteAtIndex(index, false)
              this._imageObserver.unobserve(entry.target)
            }
          }
        })
      },
      { rootMargin: '200px' }
    )
    this.state.notes.forEach((note, index) => {
      const el = document.getElementById(note._id)
      if (el) {
        el.dataset.noteIndex = index
        this._imageObserver.observe(el)
      }
    })
  }

  componentWillUnmount() {
    if (this._imageObserver) this._imageObserver.disconnect()
  }

  async getImagesForNoteAtIndex(index, refetch) {
    if (refetch) {
      // Need to refetch so we have the correct number of images to fetch
      await this.refetchNoteAtIndex(index)
    }

    var notes = this.state.notes
    var numberImages = notes[index].images?.length

    if (numberImages == 0) return

    var imagePromises = []
    for (var i = 1; i <= numberImages; i++) {
      imagePromises.push(
        db.getImagesForNote(notes[index]._id, i).catch((error) => {
          if (error?.response?.status !== 404) {
            console.error('Error fetching image', error)
          }
          return null
        })
      )
    }

    await Promise.all(imagePromises).then((responses) => {
      var imagesArray = []
      var note = notes[index]
      responses.forEach((response) => {
        if (response?.data) {
          imagesArray.push(URL.createObjectURL(response.data))
        }
      })
      note.imageUrls = imagesArray
      notes[index] = note
      this.setState({ notes: notes })
    })
  }

  setNoteMode(noteId, mode) {
    this.setState(
      {
        selectedNote: noteId,
        focusType: mode,
      },
      () => {
        if (mode === constants.note_modes.EDIT) {
          requestAnimationFrame(() => {
            const textArea = document.querySelector('#text')
            const takeArea = document.querySelector('#take')
            if (textArea) autosize(textArea)
            if (takeArea) autosize(takeArea)
          })
        }

        if (mode === constants.note_modes.SELECTED) {
          requestAnimationFrame(() => {
            const divToFocus = document.getElementById(noteId)
            if (divToFocus) divToFocus.focus()
          })
        }
      }
    )
  }

  onStartPileEdit(noteId) {
    this.setNoteMode(noteId, constants.note_modes.EDIT_PILES)
  }

  clearSelection() {
    let tempSelectedArray = []
    for (var i = 0; i < this.state.notes.length; i++) {
      tempSelectedArray[i] = false
    }
    this.setState({ selectedArray: tempSelectedArray, anchorIndex: 0 })
  }

  markChecked(noteIndex) {
    const tempSelectedArray = [...this.state.selectedArray]
    tempSelectedArray[noteIndex] = !tempSelectedArray[noteIndex] ?? false
    this.setState({ selectedArray: tempSelectedArray, anchorIndex: noteIndex })
  }

  markShiftChecked(noteIndex) {
    const tempSelectedArray = [...this.state.selectedArray]
    if (noteIndex > this.state.anchorIndex) {
      if (noteIndex > this.state.lastTouchedIndex) {
        for (let i = this.state.anchorIndex; i <= noteIndex; i++) {
          tempSelectedArray[i] = true
        }
      } else {
        for (let i = noteIndex; i <= this.state.lastTouchedIndex; i++) {
          tempSelectedArray[i] = false
        }
      }
    } else {
      // TODO: Support selecting above the anchor
    }

    this.setState({
      selectedArray: tempSelectedArray,
      lastTouchedIndex: noteIndex,
    })
  }

  selectAll() {
    var selected = []
    for (var i = 0; i < this.state.notes.length; i++) {
      selected[i] = true
    }
    this.setState({ selectedArray: selected })
  }

  getSelectedIndices() {
    var selectedIndices = []
    for (let i = 0; i < this.state.selectedArray.length; i++) {
      if (this.state.selectedArray[i]) {
        selectedIndices.push(i)
      }
    }

    return selectedIndices
  }

  delete() {
    let indicesToBeDeleted = this.getSelectedIndices()

    if (
      !confirm(
        `Do you want to permanently delete ${indicesToBeDeleted.length} notes?`
      )
    ) {
      return
    }

    for (var i = 0; i < indicesToBeDeleted.length; i++) {
      var noteId = this.state.notes[indicesToBeDeleted[i]]._id
      db.deleteRecord(db.types.note, noteId)
    }

    this.setState({ deleted: indicesToBeDeleted })
    this.clearSelection()
  }

  handleAddNew(idToAdd) {
    var linkType = this.state.toAdd

    let indicesToBeModified = this.getSelectedIndices()
    for (let i = 0; i < indicesToBeModified.length; i++) {
      var noteId = this.state.notes[indicesToBeModified[i]]._id
      db.addLinkToRecord(linkType, idToAdd, db.types.note, noteId).then(
        (response) => {
          var tempNotes = this.state.notes
          const note = response.data.data
          tempNotes[indicesToBeModified[i]] = note
          this.setState({ notes: tempNotes })
        }
      )
    }
  }

  async handleCreateAndAdd(name) {
    var newIdToAssign = await db.createRecord(this.state.toAdd, name)
    this.handleAddNew(newIdToAssign.data.data._id)
  }

  async bulkOcr() {
    let indicesToBeProcessed = this.getSelectedIndices()

    if (indicesToBeProcessed.length === 0) {
      alert('No notes selected for OCR processing')
      return
    }

    if (
      !confirm(
        `Process ${indicesToBeProcessed.length} notes with OCR? This will update notes that have no text.`
      )
    ) {
      return
    }

    let noteIds = indicesToBeProcessed.map(
      (index) => this.state.notes[index]._id
    )

    try {
      const response = await db.bulkOcrForNotes(noteIds)
      const results = response.data.data

      let updatedNotes = [...this.state.notes]
      let updatedCount = 0

      results.forEach((result) => {
        if (result.success && result.textUpdated) {
          const noteIndex = updatedNotes.findIndex(
            (note) => note._id === result.noteId
          )
          if (noteIndex !== -1) {
            updatedNotes[noteIndex].text = result.ocrText
            updatedCount++
          }
        }
      })

      this.setState({ notes: updatedNotes })
    } catch (error) {
      console.error('Bulk OCR error:', error)
      alert('Error processing OCR. Please try again.')
    }

    this.clearSelection()
  }

  async bulkSuggestTitles() {
    let indicesToBeProcessed = this.getSelectedIndices()

    if (indicesToBeProcessed.length === 0) {
      alert('No notes selected for title suggestion')
      return
    }

    if (!confirm(`Suggest titles for ${indicesToBeProcessed.length} notes?`)) {
      return
    }

    let noteIds = indicesToBeProcessed.map(
      (index) => this.state.notes[index]._id
    )

    try {
      const response = await db.bulkSuggestTitlesForNotes(noteIds)
      const results = response.data.data

      let updatedNotes = [...this.state.notes]
      let updatedCount = 0

      results.forEach((result) => {
        if (result.success && result.titleUpdated) {
          const noteIndex = updatedNotes.findIndex(
            (note) => note._id === result.noteId
          )
          if (noteIndex !== -1) {
            updatedNotes[noteIndex].title = result.suggestedTitle
            updatedCount++
          }
        }
      })

      this.setState({ notes: updatedNotes })
    } catch (error) {
      console.error('Bulk Suggest Titles error:', error)
      alert('Error suggesting titles. Please try again.')
    }

    this.clearSelection()
  }

  async bulkExportToMarkdown() {
    let indicesToBeProcessed = this.getSelectedIndices()

    if (indicesToBeProcessed.length === 0) {
      alert('No notes selected for markdown export')
      return
    }

    let noteIds = indicesToBeProcessed.map(
      (index) => this.state.notes[index]._id
    )

    try {
      const response = await db.bulkGetNotesForMarkdown(noteIds)
      const results = response.data.data

      const successfulResults = results.filter((result) => result.success)

      if (successfulResults.length === 0) {
        alert('No notes could be processed for markdown export')
        return
      }

      const markdownLines = successfulResults.map(
        (result) => `- \`${result.nick}\` ${result.title}`
      )

      const markdownText = markdownLines.join('\n')

      await navigator.clipboard.writeText(markdownText)

      alert(
        `Exported ${successfulResults.length} notes to clipboard as markdown`
      )
    } catch (error) {
      console.error('Bulk Markdown Export error:', error)
      alert('Error exporting notes to markdown. Please try again.')
    }

    this.clearSelection()
  }

  render() {
    var showMultiselect =
      this.props.viewMode == constants.view_modes.FULL ||
      this.props.viewMode == constants.view_modes.RESULT
    var isTileView = this.props.viewMode == constants.view_modes.TILE
    return (
      <div className="multi-select">
        {showMultiselect ? null : this.state.selectedArray.some((x) => x) ? (
          <div className="multi-select-top-bar">
            {this.state.addSomething ? (
              <Autocomplete
                inputName="multiselect"
                className="multi-select"
                clearOnSelect={true}
                escape={() => {
                  this.setState({ addSomething: false, toAdd: '' })
                }}
                onSelect={this.handleAddNew.bind(this)}
                handleNewSelect={this.handleCreateAndAdd.bind(this)}
                getSuggestions={db.getSuggestions}
                apiType={this.state.toAdd}
              />
            ) : (
              <TopLevelStandardButtonContainer>
                <TopLevelStandardButton
                  name="Delete"
                  onClick={this.delete.bind(this)}
                  multiSelect={true}
                />
                <TopLevelStandardButton
                  name="Idea"
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.idea })
                  }}
                  multiSelect={true}
                  position={'left'}
                />
                <TopLevelStandardButton
                  name="Work"
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.work })
                  }}
                  multiSelect={true}
                  position={'middle'}
                />
                <TopLevelStandardButton
                  name="Author"
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.auth })
                  }}
                  multiSelect={true}
                  position={'middle'}
                />
                <TopLevelStandardButton
                  name="Pile"
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.pile })
                  }}
                  multiSelect={true}
                  position={'right'}
                />
                <TopLevelStandardButton
                  name="OCR"
                  onClick={this.bulkOcr.bind(this)}
                  multiSelect={true}
                />
                <TopLevelStandardButton
                  name="Suggest Title"
                  onClick={this.bulkSuggestTitles.bind(this)}
                  multiSelect={true}
                />
                <TopLevelStandardButton
                  name="List to Clipboard"
                  onClick={this.bulkExportToMarkdown.bind(this)}
                  multiSelect={true}
                />
                <TopLevelStandardButton
                  name="Unselect All"
                  onClick={this.clearSelection.bind(this)}
                  multiSelect={true}
                />
              </TopLevelStandardButtonContainer>
            )}
          </div>
        ) : (
          <div className="multi-select-top-bar">
            <TopLevelStandardButtonContainer>
              <TopLevelStandardButton
                name="Select All"
                onClick={this.selectAll.bind(this)}
                multiSelect={true}
              />
            </TopLevelStandardButtonContainer>

            <div>p. {this.state.pageLoading ? '…' : this.state.page}</div>

            <TopLevelStandardButtonContainer>
              <TopLevelStandardButton
                onClick={this.decPage.bind(this)}
                multiSelect={true}
                position={this.state.page == 1 ? 'hidden' : 'left'}
                disabled={this.state.pageLoading}
              >
                <img src={left} />
              </TopLevelStandardButton>
              <TopLevelStandardButton
                onClick={this.incPage.bind(this)}
                multiSelect={true}
                position={this.state.page == 1 ? 'left-right' : 'right'}
                disabled={this.state.pageLoading}
              >
                <img src={right} />
              </TopLevelStandardButton>
            </TopLevelStandardButtonContainer>
          </div>
        )}
        {this.state.notes === undefined ? (
          <div className="search-loading-state">Loading...</div>
        ) : this.state.notes.length === 0 ? (
          <div className="search-empty-state">No notes found.</div>
        ) : null}
        {this.state.notes === undefined || this.state.notes.length === 0 ? null : (
          <div className={isTileView ? 'note-tile-grid' : ''}>
            {this.state.notes.map((note, index) => {
              return (
                <div
                  key={'note-view-' + note._id}
                  className={isTileView ? 'note-tile-grid-item' : ''}
                >
                  {this.props.viewMode == constants.view_modes.GRID ? (
                    <NoteGrid
                      author={
                        note.author?.name
                          ? note.author?.name
                          : note.work?.author?.name
                      }
                      index={index}
                      selected={this.state.selectedArray[index]}
                      deleted={this.state.deleted.includes(index)}
                      authorId={note.author?._id}
                      id={note._id}
                      inFocus={this.state.inFocus}
                      key={note._id}
                      tabIndex={index + 1}
                      text={note.text}
                      title={note.title}
                      work={note.work?.name}
                      workId={note.work?._id}
                      markChecked={this.markChecked.bind(this)}
                      markShiftChecked={this.markShiftChecked.bind(this)}
                      imageCount={note.images?.length ?? 0}
                      note={note}
                    />
                  ) : this.props.viewMode == constants.view_modes.TILE ? (
                    <NoteTile
                      deleted={this.state.deleted.includes(index)}
                      id={note._id}
                      index={index}
                      inFocus={this.state.inFocus}
                      key={note._id}
                      markChecked={this.markChecked.bind(this)}
                      markShiftChecked={this.markShiftChecked.bind(this)}
                      note={note}
                      selected={this.state.selectedArray[index]}
                      tabIndex={index + 1}
                    />
                  ) : this.props.viewMode == constants.view_modes.SLIM ? (
                    <NoteSlim
                      deleted={this.state.deleted.includes(index)}
                      id={note._id}
                      index={index}
                      inFocus={this.state.inFocus}
                      key={note._id}
                      markChecked={this.markChecked.bind(this)}
                      markShiftChecked={this.markShiftChecked.bind(this)}
                      note={note}
                      selected={this.state.selectedArray[index]}
                      tabIndex={index + 1}
                    />
                  ) : this.props.viewMode == constants.view_modes.RESULT ? (
                    <NoteResult note={note} id={note._id} key={note._id} />
                  ) : (
                    <Note
                      note={note}
                      id={note._id}
                      key={note._id}
                      tabIndex={index + 1}
                      index={index}
                      refetchMe={this.refetchNoteAtIndex.bind(this)}
                      getImagesForNoteAtIndex={this.getImagesForNoteAtIndex.bind(
                        this
                      )}
                      mode={
                        !this.state.selectedNote
                          ? constants.note_modes.NO_SELECTION
                          : this.state.selectedNote == note._id
                          ? this.state.focusType
                          : constants.note_modes.NOT_SELECTED
                      }
                      setNoteMode={this.setNoteMode.bind(this)}
                      onStartPileEdit={this.onStartPileEdit.bind(this)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }
}

// Wrapper component that provides keyboard shortcuts
function NoteListWithKeyboard(props) {
  const noteListRef = React.useRef(null)

  // Section 4: Note List keyboard shortcuts
  useKeyboardShortcuts(
    constants.keyboardScopes.NOTE_LIST,
    (event) => {
      if (!noteListRef.current) return false
      return noteListRef.current.handleKeyboardShortcut(event)
    },
    [props.viewMode]
  )

  return <NoteList ref={noteListRef} {...props} />
}

export default NoteListWithKeyboard
