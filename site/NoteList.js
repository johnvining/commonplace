import React from 'react'
import Note from './Note'
import NoteSlim from './NoteSlim'
import NoteGrid from './NoteGrid'
import * as db from './Database'
import Autocomplete from './Autocomplete'
import * as constants from './constants'
import left from './icons/left.svg'
import right from './icons/right.svg'

class NoteList extends React.Component {
  state = {
    inFocus: null,
    notes: [],
    selected: [],
    deleted: [],
    lastSelectedIndex: 0,
    useGridView: 1,
    page: 1
  }

  async componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)

    const response = await this.props.getListOfNotes(
      this.props.index,
      this.state.page
    )
    this.setState(
      {
        notes: response.data.data
      },
      () => {
        for (let i = 0; i < this.state.notes.length; i++) {
          this.getImagesForNoteAtIndex(i, false)
        }
      }
    )
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
    let notes = this.state.notes
    const response = await db.getNoteInfo(notes[index]._id)
    const note = response.data.data[0]
    notes[index] = note
    this.setState({ notes: notes })
  }

  async getImagesForNoteAtIndex(index, refetch) {
    if (refetch) {
      // Need to refetch so we have the correct number of images to fetch
      await this.refetchNoteAtIndex(index)
    }

    let notes = this.state.notes
    var numberImages = notes[index].images?.length

    if (numberImages == 0) return

    let imagePromises = []
    for (let i = 1; i <= numberImages; i++) {
      imagePromises.push(db.getImagesForNote(notes[index]._id, i))
    }

    await Promise.all(imagePromises).then(responses => {
      let imagesArray = []
      let note = notes[index]
      responses.map(response => {
        imagesArray.push(response.data)
      })
      note.imageBlobs = imagesArray
      notes[index] = note
      this.setState({ notes: notes })
    })
  }

  componentWillUnmount() {
    document.removeEventListener(
      'keydown',
      this.handleKeyDown.bind(this),
      false
    )
  }

  handleKeyDown(event) {
    // TODO: Keyboard short cuts will interfere with Ctrl + A on Windows
    if (event.keyCode == 13) {
      // TODO: This is clumsy -- need to avoid inner elements like Input's or anything that happens while note is being edited
      if (document.activeElement.className == 'normal note outer') {
        this.setIsFocused(document.activeElement.id)
      }
    }
  }

  setIsFocused(id) {
    this.setState({
      inFocus: id
    })
  }

  becomeInFocus(id) {
    this.setState({ inFocus: id })
  }

  markChecked(noteIndex) {
    if (this.state.selected.includes(noteIndex)) {
      let tempArray = this.state.selected
      const index = tempArray.indexOf(noteIndex)
      if (index > -1) {
        tempArray.splice(index, 1)
      }
      this.setState({ selected: tempArray })
    } else {
      let tempArray = this.state.selected
      tempArray.push(noteIndex)
      this.setState({ selected: tempArray, lastSelectedIndex: noteIndex })
    }
  }

  markShiftChecked(id) {
    let start = Math.min(this.state.lastSelectedIndex, id)
    let end = Math.max(this.state.lastSelectedIndex, id)
    let tempArray = this.state.selected
    for (let i = start; i <= end; i++) {
      if (!this.state.selected.includes(i) && !this.state.deleted.includes(i)) {
        tempArray.push(i)
      }
    }
    this.setState({ selected: tempArray })
  }

  selectAll() {
    let selected = []
    for (let i = 0; i < this.state.notes.length; i++) {
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

    // TODO: Create API to delete multiple
    for (let i = 0; i < this.state.selected.length; i++) {
      let noteId = this.state.notes[this.state.selected[i]]._id
      db.deleteNote(noteId)
    }

    this.setState({ deleted: this.state.selected, selected: [] })
  }

  handleAddNew(idToAdd) {
    var assignFunction
    switch (this.state.toAdd) {
      case 'author':
        assignFunction = db.addAuthorToNote
        break
      case 'idea':
        assignFunction = db.addIdeaToNote
        break
      case 'work':
        assignFunction = db.addWorkToNote
        break
      default:
        return
    }

    // TODO: Single API call for multiple changes
    for (let i = 0; i < this.state.selected.length; i++) {
      let noteId = this.state.notes[this.state.selected[i]]._id
      assignFunction(idToAdd, noteId).then(response => {
        let notes = this.state.notes
        const note = response.data
        notes[this.state.selected[i]] = note
        this.setState({ notes: notes })
      })
    }
  }

  async handleCreateAndAdd(name) {
    var createFunction
    switch (this.state.toAdd) {
      case 'author':
        createFunction = db.createAuthor
        break
      case 'idea':
        createFunction = db.createIdea
        break
      case 'work':
        createFunction = db.createWork
        break
      default:
        return
    }

    // TODO: Create single API call
    let newIdToAssign = await createFunction(name)
    this.handleAddNew(newIdToAssign.data.data._id)
  }

  getSuggestions(string) {
    switch (this.state.toAdd) {
      case 'author':
        return db.getAuthorSuggestions(string)
      case 'idea':
        return db.getIdeaSuggestions(string)
      case 'work':
        return db.getWorkSuggestions(string)
    }
  }

  render() {
    return (
      <div className="multi-select">
        {this.props.viewMode == constants.view_modes.FULL ? null : this.state
            .selected.length ? (
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
                getSuggestions={this.getSuggestions.bind(this)}
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
                    this.setState({ addSomething: true, toAdd: 'idea' })
                  }}
                  className="multi-select button"
                >
                  Idea
                </button>
                <button
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: 'work' })
                  }}
                  className="multi-select button"
                >
                  Work
                </button>
                <button
                  onClick={() => {
                    this.setState({ addSomething: true, toAdd: 'author' })
                  }}
                  className="multi-select button"
                >
                  Author
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
                      author={note.author?.name}
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
                      author={note.author?.name}
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
                  ) : (
                    <Note
                      note={note}
                      id={note._id}
                      key={note._id}
                      tabIndex={index + 1}
                      index={index}
                      inFocus={this.state.inFocus}
                      becomeInFocus={this.becomeInFocus.bind(this)}
                      refetchMe={this.refetchNoteAtIndex.bind(this)}
                      getImagesForNoteAtIndex={this.getImagesForNoteAtIndex.bind(
                        this
                      )}
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
