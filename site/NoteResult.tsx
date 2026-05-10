import React from 'react'
import { Link } from 'react-router-dom'
import note_img from 'url:./icons/write.svg'
import WorkCitationSpan from './WorkCitationSpan'
import PinButton from './PinButton'

function snippetAround(text: any, query: any) {
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

class NoteResult extends React.PureComponent<any> {
  render() {
    const note = this.props.note
    const hl = this.props.highlight

    const authorName = note.author?.name ?? note.work?.author?.name
    const authorID = note.author?._id ?? null
    const workTitle = note.work?.name ?? null
    const workID = note.work?._id ?? null
    const hasAttribution = authorName || workTitle

    const title = note.title?.length ? note.title : null
    const body = note.text?.length ? note.text : note.take?.length ? note.take : null

    const titleContainsHl = hl && title && title.toLowerCase().includes(hl.toLowerCase())
    const bodyContainsHl = hl && body && body.toLowerCase().includes(hl.toLowerCase())

    let primaryText = title || body
    let secondaryText = null

    if (title && hl && !titleContainsHl && bodyContainsHl) {
      secondaryText = body
    } else if (!title && body) {
      primaryText = body
    }

    const primaryContent = hl && primaryText
      ? snippetAround(primaryText, hl)
      : primaryText

    const secondaryContent = secondaryText
      ? snippetAround(secondaryText, hl)
      : null

    const labelText = title || body || 'Untitled Note'
    const ideas = note.ideas?.length ? note.ideas : null

    return (
      <Link to={`/note/${note._id}`} key={'note-list-' + note._id}>
        <div className="result-box">
          <div className="result-box header">
            <img src={note_img} />
            <span className="truncate">
              {hasAttribution ? (
                <>
                  <WorkCitationSpan
                    authorName={authorName}
                    authorID={authorID}
                    workTitle={workTitle}
                    workID={workID}
                    spaceAfter={false}
                    plain={true}
                  />
                  {': '}
                </>
              ) : null}
              {primaryContent}
            </span>
            {this.props.semantic ? <span className="semantic-badge">~</span> : null}
            <PinButton
              type="note"
              id={note._id}
              label={labelText}
              href={`/note/${note._id}`}
              compact={true}
              className="pin-button-inline"
            />
          </div>
          {secondaryContent ? (
            <div className="result-box-snippet">{secondaryContent}</div>
          ) : null}
          {ideas ? (
            <div className="result-box-ideas">
              {ideas.map((i: any) => (
                <span key={i._id} className="idea">{i.name}</span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    )
  }
}

export default NoteResult
