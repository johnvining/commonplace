import React from 'react'
import axios from 'axios'
import Note from './Note'

class NoteList extends React.Component {
  state = { inFocus: null }
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

  render() {
    return (
      <div>
        {this.props.notes === undefined ? null : (
          <div>
            {this.props.notes.map((note, index) => {
              return (
                <Note
                  key={note._id}
                  title={note.title}
                  author={note.author?.name}
                  authorId={note.author?._id}
                  text={note.text}
                  ideas={note.ideas}
                  id={note._id}
                  tabIndex={index + 1}
                  inFocus={this.state.inFocus}
                  work={note.work?.name}
                  workId={note.work?._id}
                  becomeInFocus={this.becomeInFocus.bind(this)}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }
}

export default NoteList
