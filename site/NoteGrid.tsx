import React from 'react'
import { Link } from 'react-router-dom'
import * as db from './Database'
import ClickToCopyNick from './ClickToCopyNick'
import { authorsWithWorkFallback, joinAuthorNames } from './authorsDisplay'
import { CompactNoteProps, SelectToggle, imageCountLabel } from './NoteCompactParts'

class NoteGrid extends React.Component<CompactNoteProps, any> {
  state: any = {}

  componentDidMount() {
    if (this.props.note && this.props.note.nick) {
      this.setState({ nick: this.props.note.nick })
    } else {
      db.getNoteNick(this.props.id).then((response: any) => {
        this.setState({ nick: response.data.data.key })
      })
    }
  }

  render() {
    if (this.props.deleted) {
      return <div> </div>
    }

    const { note, id } = this.props
    return (
      <div className={this.props.selected ? 'grid-selected' : 'grid'}>
        <div className="grid-div-button">
          <SelectToggle {...this.props} />
        </div>

        <div className="grid-link">
          <Link to={'/note/' + id} tabIndex={this.props.tabIndex} data-note-id={id}>
            <div className="grid-nick">
              <ClickToCopyNick nick={this.state.nick} disableClick={true} />
              <span className="grid-unprintable">|</span>
            </div>
            <div className="grid-author">
              {joinAuthorNames(authorsWithWorkFallback(note.authors, note.work?.authors))}
              <span className="grid-unprintable">|</span>
            </div>
            <div className="grid-title">
              {note.title}
              <span className="grid-unprintable">|</span>
            </div>
            <div className="grid-text">
              {imageCountLabel(note.images?.length)}
              {note.text}
            </div>
          </Link>
        </div>
      </div>
    )
  }
}

export default NoteGrid
