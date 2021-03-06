import React from 'react'
import { Link } from '@reach/router'
import note_img from './icons/write.svg'
import NoteAuthorSpan from './NoteAuthorSpan'

class NoteResult extends React.Component {
  render() {
    return (
      <Link
        to={`/note/${this.props.note._id}`}
        key={'note-list-' + this.props.note._id}
      >
        <div className="result-box">
          <div className="result-box header">
            <img src={note_img}></img>
            <span className="truncate">
              <NoteAuthorSpan note={this.props.note} />: {this.props.note.title}
            </span>
          </div>
        </div>
      </Link>
    )
  }
}

export default NoteResult
