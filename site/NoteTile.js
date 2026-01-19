import React from 'react'
import { Link } from 'react-router-dom'
import circle from 'url:./icons/circle.svg'
import check_circle from 'url:./icons/check_circle.svg'
import WorkCitationSpan from './WorkCitationSpan'

class NoteTile extends React.Component {
  markChecked(e) {
    if (e.shiftKey) {
      this.props.markShiftChecked(this.props.index)
    } else {
      this.props.markChecked(this.props.index)
    }
  }

  render() {
    if (this.props.deleted) {
      return <div> </div>
    }

    const outerClassName = this.props.selected
      ? 'note-slim outer selected'
      : 'note-slim outer'

    const hasImages = this.props.note.imageUrls?.length > 0

    return (
      <div className={outerClassName + ' tile'}>
        <div
          className={
            hasImages
              ? 'note-slim tile-body has-images'
              : 'note-slim tile-body no-images'
          }
        >
          <Link to={'/note/' + this.props.id} className="note-slim">
            <div tabIndex={this.props.tabIndex} className="note-slim">
              <div className="note-slim tile-title">
                <b>
                  {this.props.note.title?.length
                    ? this.props.note.title
                    : 'no title'}
                  .
                </b>
              </div>
              {hasImages ? (
                <div className="note-slim tile-images has-images">
                  {this.props.note.imageUrls.slice(0, 4).map((url, idx) => (
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
            {this.props.note.piles?.map((pile, idx) => (
              <span className="pile" key={'pile-' + this.props.id + idx}>
                {pile.name}
              </span>
            ))}
            {this.props.note.ideas?.map((idea, idx) => (
              <span className="idea" key={'idea-' + this.props.id + idx}>
                {idea.name}
              </span>
            ))}
          </div>
        </div>
        <div className="note-slim tile-footer">
          <div className="note-slim tile-footer-select">
            {this.props.selected ? (
              <button
                onClick={this.markChecked.bind(this)}
                className="grid-button"
              >
                <img src={check_circle} />
              </button>
            ) : (
              <button
                onClick={this.markChecked.bind(this)}
                className="grid-button"
              >
                <img src={circle} />
              </button>
            )}
          </div>
          <div className="note-slim tile-footer-meta">
            <WorkCitationSpan
              authorName={
                this.props.note.author?.name ??
                this.props.note.work?.author?.name
              }
              authorID={null}
              workTitle={this.props.note.work?.name}
              workID={null}
              spaceAfter={false}
            />
          </div>
        </div>
      </div>
    )
  }
}

export default NoteTile
