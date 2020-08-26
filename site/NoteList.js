import React from 'react'
import axios from 'axios'
import Note from './Note'
import NoteSlim from './NoteSlim'

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
                <div>
                  {this.props.useSlim ? (
                    <NoteSlim
                      author={note.author?.name}
                      authorId={note.author?._id}
                      id={note._id}
                      inFocus={this.state.inFocus}
                      key={note._id}
                      tabIndex={index + 1}
                      text={note.text}
                      title={note.title}
                      work={note.work?.name}
                      workId={note.work?._id}
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
