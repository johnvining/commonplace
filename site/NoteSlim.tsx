import React from 'react'
import { Link } from 'react-router-dom'
import WorkCitationSpan from './WorkCitationSpan'
import { authorsWithWorkFallback } from './authorsDisplay'
import { wornClass, wornTitle } from './utils'
import { CompactNoteProps, NoteTags, SelectToggle, imageCountLabel } from './NoteCompactParts'

class NoteSlim extends React.PureComponent<CompactNoteProps> {
  render() {
    if (this.props.deleted) {
      return <div> </div>
    }

    const { note, id } = this.props
    const outerClassName = this.props.selected
      ? 'note-slim outer selected'
      : 'note-slim outer'

    return (
      <div className={outerClassName}>
        <div className="note-slim button">
          <SelectToggle {...this.props} />
        </div>
        <div className={'note-slim' + wornClass(note?.openCount)} title={wornTitle(note?.openCount)}>
          <Link to={'/note/' + id} className="note-slim" tabIndex={this.props.tabIndex} data-note-id={id}>
            <div className="note-slim">
              <div className="note-slim inner truncate">
                <WorkCitationSpan
                  authors={authorsWithWorkFallback(note.authors, note.work?.authors)}
                  workTitle={note.work?.name}
                  workID={null}
                  spaceAfter={false}
                  plain={true}
                />
                {(note.authors?.length || note.work?.authors?.length || note.work?.name) && ': '}
                <b>{note.title?.length ? note.title + '. ' : 'no title. '}</b>
                {imageCountLabel(note.images?.length)}
                {note.text?.length ? <>{note.text}</> : null}
              </div>

              <div className="note-slim inner">
                <NoteTags note={note} id={id} />
              </div>
              <div></div>
            </div>
          </Link>
        </div>
      </div>
    )
  }
}

export default NoteSlim
