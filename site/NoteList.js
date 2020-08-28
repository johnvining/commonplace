import React from 'react'
import axios from 'axios'
import Note from './Note'
import NoteSlim from './NoteSlim'
import * as db from './Database'

class NoteList extends React.Component {
  state = { inFocus: null, selected: [], deleted: [] }
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

  markChecked(id) {
    if (this.state.selected.includes(id)) {
      let tempArray = this.state.selected
      const index = tempArray.indexOf(id)
      if (index > -1) {
        tempArray.splice(index, 1)
      }
      this.setState({ selected: tempArray })
    } else {
      let tempArray = this.state.selected
      tempArray.push(id)
      this.setState({ selected: tempArray })
    }
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
    console.log(this.state.selected)
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
                      selected={this.state.selected.includes(note._id)}
                      deleted={this.state.deleted.includes(note._id)}
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
