import React from 'react'
import { Link } from 'react-router-dom'
import note_img from 'url:./icons/write.svg'
import NoteAuthorSpan from './NoteAuthorSpan'
import PinButton from './PinButton'

function snippetAround(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{text}</>
  const BEFORE = 40
  const start = Math.max(0, idx - BEFORE)
  const end = Math.min(text.length, idx + query.length + 80)
  return (
    <>
      {start > 0 ? '…' : null}
      {text.slice(start, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length, end)}
      {end < text.length ? '…' : null}
    </>
  )
}

class NoteResult extends React.PureComponent {
  render() {
    const note = this.props.note
    const hl = this.props.highlight
    const author = <NoteAuthorSpan note={note} separator=": " />

    let contentText = null
    if (note.title?.length) {
      contentText = note.title
    } else if (note.text?.length) {
      contentText = note.text
    } else if (note.take?.length) {
      contentText = note.take
    }

    const content = hl && contentText
      ? snippetAround(contentText, hl)
      : contentText

    return (
      <Link to={`/note/${note._id}`} key={'note-list-' + note._id}>
        <div className="result-box">
          <div className="result-box header">
            <img src={note_img} />
            <span className="truncate">
              {author}
              {content}
            </span>
            {this.props.semantic ? <span className="semantic-badge">~</span> : null}
            <PinButton
              type="note"
              id={note._id}
              label={contentText || 'Untitled Note'}
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
