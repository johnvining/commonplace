import React from 'react'
import { Link } from 'react-router-dom'
import circle from 'url:./icons/circle.svg'
import check_circle from 'url:./icons/check_circle.svg'
import WorkCitationSpan from './WorkCitationSpan'
import { authorsWithWorkFallback } from './authorsDisplay'

class NoteTile extends React.PureComponent<any> {
  markChecked(e: any) {
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
            <button
              onClick={this.markChecked.bind(this)}
              className="button grid-button"
            >
              <img src={this.props.selected ? check_circle : circle} />
            </button>
            <Link
              to={'/note/' + this.props.id}
              className="note-slim tile-title-link"
              tabIndex={this.props.tabIndex}
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
          <Link to={'/note/' + this.props.id} className="note-slim tile-link">
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
            {this.props.note.piles?.map((pile: any, idx: any) => (
              <span className="pile" key={'pile-' + this.props.id + idx}>
                {pile.name}
              </span>
            ))}
            {this.props.note.ideas?.map((idea: any, idx: any) => (
              <span className="idea" key={'idea-' + this.props.id + idx}>
                {idea.name}
              </span>
            ))}
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
