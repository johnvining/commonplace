import React from 'react'
import Note from './Note'
import NoteSlim from './NoteSlim'
import NoteGrid from './NoteGrid'
import NoteResult from './NoteResult'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import * as constants from './constants'
import left from './icons/left.svg'
import right from './icons/right.svg'
import autosize from 'autosize'

class NoteList extends React.Component {
  state = {
    inFocus: null,
    focusType: constants.note_modes.NO_SELECTION,
    selectedNote: '',
    notes: [],
    selected: [],
    deleted: [],
    lastSelectedIndex: 0,
    useGridView: 1,
    page: 1
  }

  async componentDidMount() {
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)

    const response = await this.props.getListOfNotes(
      this.props.index,
      this.state.page
    )
    this.setState(
      {
        notes: response.data.data
      },
      () => {
        for (var i = 0; i < this.state.notes.length; i++) {
          this.getImagesForNoteAtIndex(i, false)
        }
      }
    )

    if (this.props.editFirst && this.state.notes[0]) {
      this.setNoteMode(this.state.notes[0]._id, constants.note_modes.EDIT)
      autosize(document.querySelector('#text'))
      autosize(document.querySelector('#take'))
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keyDownListener, false)
  }

  async incPage() {
    const response = await this.props.getListOfNotes(
      this.props.index,
      this.state.page + 1
    )
    this.setState({
      notes: response.data.data,
      page: this.state.page + 1,
      selected: []
    })
  }

  async decPage() {
    const response = await this.props.getListOfNotes(
      this.props.index,
      this.state.page - 1
    )
    this.setState({
      notes: response.data.data,
      page: this.state.page - 1,
      selected: []
    })
  }

  async refetchNoteAtIndex(index) {
    var notes = this.state.notes
    const response = await db.getInfo(db.types.note, notes[index]._id)
    var note = response.data.data[0]
    note.imageUrls = this.state.notes[index].imageUrls
    notes[index] = note
    this.setState({ notes: notes })
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
      imagePromises.push(db.getImagesForNote(notes[index]._id, i))
    }

    await Promise.all(imagePromises).then(responses => {
      var imagesArray = []
      var note = notes[index]
      responses.map(response => {
        imagesArray.push(URL.createObjectURL(response.data))
      })
      note.imageUrls = imagesArray
      notes[index] = note
      this.setState({ notes: notes })
    })
  }

  handleKeyDown(event) {
    if (event.ctrlKey) {
      switch (event.keyCode) {
        case 69: // Ctrl E'
          this.setNoteMode(document.activeElement.id, constants.note_modes.EDIT)
          autosize(document.querySelector('#text'))
          autosize(document.querySelector('#take'))
          break
        case 84: // Ctrl T
          this.setNoteMode(
            document.activeElement.id,
            constants.note_modes.EDIT_IDEAS
          )
          break
        case 80: // Ctrl P
          this.setNoteMode(
            document.activeElement.id,
            constants.note_modes.EDIT_PILES
          )
      }
    } else {
      switch (event.keyCode) {
        case 13: // Enter
          if (this.state.focusType == constants.note_modes.NO_SELECTION) {
            this.setNoteMode(
              document.activeElement.id,
              constants.note_modes.SELECTED
            )
          }

          break
        case 27: // Escape
          var divToFocus = document.getElementById(this.state.selectedNote)
          this.setNoteMode('', constants.note_modes.NO_SELECTION)
          divToFocus.focus()
          break
      }
    }
  }

  setNoteMode(noteId, mode) {
    if (mode == constants.note_modes.SELECT) {
      let divToFocus = document.getElementById(this.state.selectedNote)
      divToFocus.focus()
    }
    this.setState({
      selectedNote: noteId,
      focusType: mode
    })
  }

  onStartPileEdit(noteId) {
    this.setNoteMode(noteId, constants.note_modes.EDIT_PILES)
  }

  markChecked(noteIndex) {
    if (this.state.selected.includes(noteIndex)) {
      var tempArray = this.state.selected
      const index = tempArray.indexOf(noteIndex)
      if (index > -1) {
        tempArray.splice(index, 1)
      }
      this.setState({ selected: tempArray })
    } else {
      var tempArray = this.state.selected
      tempArray.push(noteIndex)
      this.setState({ selected: tempArray, lastSelectedIndex: noteIndex })
    }
  }

  markShiftChecked(id) {
    var start = Math.min(this.state.lastSelectedIndex, id)
    var end = Math.max(this.state.lastSelectedIndex, id)
    var tempArray = this.state.selected
    for (var i = start; i <= end; i++) {
      if (!this.state.selected.includes(i) && !this.state.deleted.includes(i)) {
        tempArray.push(i)
      }
    }
    this.setState({ selected: tempArray })
  }

  selectAll() {
    var selected = []
    for (var i = 0; i < this.state.notes.length; i++) {
      selected.push(i)
    }
    this.setState({ selected: selected })
  }

  delete() {
    if (
      !confirm(
        `Do you want to permanently delete ${this.state.selected.length} notes?`
      )
    ) {
      return
    }

    for (var i = 0; i < this.state.selected.length; i++) {
      var noteId = this.state.notes[this.state.selected[i]]._id
      db.deleteRecord(db.types.note, noteId)
    }

    this.setState({ deleted: this.state.selected, selected: [] })
  }

  handleAddNew(idToAdd) {
    var linkType = this.state.toAdd

    // TODO: Single API call for multiple changes
    for (let i = 0; i < this.state.selected.length; i++) {
      var noteId = this.state.notes[this.state.selected[i]]._id
      db.addLinkToRecord(linkType, idToAdd, db.types.note, noteId).then(
        response => {
          var tempNotes = this.state.notes
          const note = response.data.data
          tempNotes[this.state.selected[i]] = note
          this.setState({ notes: tempNotes })
        }
      )
    }
  }

  async handleCreateAndAdd(name) {
    // TODO: Create single API call
    var newIdToAssign = await db.createRecord(this.state.toAdd, name)
    this.handleAddNew(newIdToAssign.data.data._id)
  }

  render() {
    var showMultiselect =
      this.props.viewMode == constants.view_modes.FULL ||
      this.props.viewMode == constants.view_modes.RESULT
    return (
      <div className="multi-select">
        {showMultiselect ? null : this.state.selected.length ? (
          <div>
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
              <div>
                <button
                  onClick={this.delete.bind(this)}
                  className="multi-select button"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.idea })
                  }}
                  className="multi-select button"
                >
                  Idea
                </button>
                <button
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.work })
                  }}
                  className="multi-select button"
                >
                  Work
                </button>
                <button
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.auth })
                  }}
                  className="multi-select button"
                >
                  Author
                </button>
                <button
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: db.types.pile })
                  }}
                  className="multi-select button"
                >
                  Pile
                </button>
                <button
                  onClick={() => {
                    this.setState({ selected: [], lastSelectedIndex: 0 })
                  }}
                  className="multi-select button"
                >
                  Unselect All
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="multi-select-top-bar">
            <div>
              <button
                onClick={this.selectAll.bind(this)}
                className="multi-select button"
              >
                Select All
              </button>
            </div>
            <div>p. {this.state.page}</div>
            <div>
              <button
                className={
                  this.state.page == 1
                    ? 'multi-select button hidden'
                    : 'multi-select button'
                }
                onClick={this.decPage.bind(this)}
              >
                {' '}
                <img src={left} />
              </button>

              <button
                className="multi-select button"
                onClick={this.incPage.bind(this)}
              >
                <img src={right} />
              </button>
            </div>
          </div>
        )}
        {this.state.notes === undefined ? null : (
          <div>
            {this.state.notes.map((note, index) => {
              return (
                <div key={'note-view-' + note._id}>
                  {this.props.viewMode == constants.view_modes.GRID ? (
                    <NoteGrid
                      author={
                        note.author?.name
                          ? note.author?.name
                          : note.work?.author?.name
                      }
                      index={index}
                      selected={this.state.selected.includes(index)}
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
                      selected={this.state.selected.includes(index)}
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

export default NoteList
