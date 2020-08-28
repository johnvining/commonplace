import React from 'react'
import Note from './Note'
import NoteSlim from './NoteSlim'
import * as db from './Database'

// TODO: Unselect on switching to slim

class NoteList extends React.Component {
  state = { inFocus: null, selected: [], deleted: [], lastSelectedIndex: 0 }
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

  handleKeyDown(event) {
    // TODO: Keyboard short cuts will interfere with Ctrl + A on Windows
    if (event.keyCode == 13) {
      // TODO: This is clumsy -- need to avoid inner elements like Input's or anything that happens while note is being edited
      if (document.activeElement.className == 'noteNormal-outer') {
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

  delete() {
    if (
      !confirm(
        `Do you want to permanently delete ${this.state.selected.length} notes?`
      )
    ) {
      return
    }

    for (let i = 0; i < this.state.selected.length; i++) {
      db.deleteNote(this.state.selected[i])
    }

    this.setState({ deleted: this.state.selected, selected: [] })
  }

  render() {
    return (
      <div>
        {this.state.selected.length ? (
          <div>
            <button onClick={this.delete.bind(this)}>Delete</button>
            <button>Idea</button>
            <button>Work</button>
            <button>Author</button>
          </div>
        ) : null}

        {this.props.notes === undefined ? null : (
          <div>
            {this.props.notes.map((note, index) => {
              return (
                <div key={'note-view-' + note._id}>
                  {this.props.useSlim ? (
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
                      author={note.author?.name}
                      authorId={note.author?._id}
                      becomeInFocus={this.becomeInFocus.bind(this)}
                      id={note._id}
                      ideas={note.ideas}
                      inFocus={this.state.inFocus}
                      key={note._id}
                      tabIndex={index + 1}
                      text={note.text}
                      title={note.title}
                      work={note.work?.name}
                      workId={note.work?._id}
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
