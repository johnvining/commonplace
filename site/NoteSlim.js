import React from 'react'
import { Link } from '@reach/router'
import circle from './icons/circle.svg'
import check_circle from './icons/check_circle.svg'

class NoteSlim extends React.Component {
  state = {}

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

    return (
      <div
        className={
          this.props.selected ? 'note-slim-outer selected' : 'note-slim-outer'
        }
      >
        <div className="note-slim button">
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
        <div className="note-slim text">
          <Link to={'/note/' + this.props.id} className="note-slim">
            <div tabIndex={this.props.tabIndex} className="note-slim">
              <b>
                {this.props.title?.length ? (
                  this.props.title
                ) : (
                  <em>No title</em>
                )}
              </b>
              <br />
              {this.props.text?.length ? this.props.text : <span>&#8212;</span>}
              <br />
              <div align="right">
                {this.props.author?.length ? (
                  this.props.author
                ) : (
                  <em>No author</em>
                )}
                {this.props.work?.length ? (
                  <em>,&nbsp;&nbsp;{this.props.work}</em>
                ) : null}
              </div>
            </div>
          </Link>
        </div>
      </div>
    )
  }
}

export default NoteSlim
