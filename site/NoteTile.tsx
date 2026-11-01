import React from 'react'
import { Link } from 'react-router-dom'
import WorkCitationSpan from './WorkCitationSpan'
import { authorsWithWorkFallback } from './authorsDisplay'
import { CompactNoteProps, NoteTags, SelectToggle } from './NoteCompactParts'

class NoteTile extends React.PureComponent<CompactNoteProps> {
  render() {
    if (this.props.deleted) {
      return <div> </div>
    }

    const outerClassName = this.props.selected
      ? 'note-slim outer selected'
      : 'note-slim outer'

    const imageCount = this.props.note.imageUrls?.length || 0
    const hasImages = imageCount > 0
    const imageLayoutClass =
      imageCount === 1 ? 'count-1' : imageCount === 2 ? 'count-2' : 'count-3plus'

    return (
      <div className={outerClassName + ' tile'}>
        <div
          className={
            hasImages
              ? 'note-slim tile-body has-images'
              : 'note-slim tile-body no-images'
          }
        >
          <div className="note-slim tile-header">
            <SelectToggle {...this.props} />
            <Link
              to={'/note/' + this.props.id}
              className="note-slim tile-title-link"
              tabIndex={this.props.tabIndex}
              data-note-id={this.props.id}
            >
              <div className="note-slim tile-title">
                <b>
                  {this.props.note.title?.length
                    ? this.props.note.title
                    : 'no title'}
                  .
                </b>
              </div>
            </Link>
          </div>
          <Link to={'/note/' + this.props.id} className="note-slim tile-link" tabIndex={-1}>
            <div tabIndex={-1} className="note-slim">
              {hasImages ? (
                <div
                  className={`note-slim tile-images has-images ${imageLayoutClass}`}
                >
                  {this.props.note.imageUrls.slice(0, 4).map((url: any, idx: any) => (
                    <div
                      className="note-slim tile-image-frame"
                      key={`${this.props.id}-tile-image-${idx}`}
                    >
                      <img src={url} className="note-slim tile-image" alt="" />
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="note-slim tile-text">
                {this.props.note.text?.length ? <>{this.props.note.text}</> : null}
              </div>
            </div>
          </Link>
          <div className="note-slim tile-tags">
            <NoteTags note={this.props.note} id={this.props.id} />
          </div>
        </div>
        <div className="note-slim tile-footer">
          <div className="note-slim tile-footer-meta">
            <WorkCitationSpan
              authors={authorsWithWorkFallback(this.props.note.authors, this.props.note.work?.authors)}
              workTitle={this.props.note.work?.name}
              workID={null}
              spaceAfter={false}
              plain={true}
            />
          </div>
        </div>
      </div>
    )
  }
}

export default NoteTile
