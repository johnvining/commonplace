import React from 'react'
import { Link } from 'react-router-dom'
import note_img from 'url:./icons/write.svg'
import NoteAuthorSpan from './NoteAuthorSpan'
import PinButton from './PinButton'

class NoteResult extends React.Component {
  render() {
    const note = this.props.note
    const author = <NoteAuthorSpan note={note} separator=": " />
    
    // Determine what to show after author in preference order: title, text, take
    let content = null
    if (note.title?.length) {
      content = note.title
    } else if (note.text?.length) {
      content = note.text
    } else if (note.take?.length) {
      content = note.take
    }
    
    return (
      <Link
        to={`/note/${note._id}`}
        key={'note-list-' + note._id}
      >
        <div className="result-box">
          <div className="result-box header">
            <img src={note_img}></img>
            <span className="truncate">
              {author}
              {content}
            </span>
            <PinButton
              type="note"
              id={note._id}
              label={content || 'Untitled Note'}
              href={`/note/${note._id}`}
              compact={true}
              className="pin-button-inline"
            />
          </div>
        </div>
      </Link>
    )
  }
}

export default NoteResult
