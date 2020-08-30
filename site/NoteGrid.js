import React, { useRef } from 'react'
import { Link, redirectTo } from '@reach/router'
import circle from './icons/circle.svg'
import check_circle from './icons/check_circle.svg'

class NoteGrid extends React.Component {
  state = {}

  markChecked(e) {
    if (e.shiftKey) {
      this.props.markShiftChecked(this.props.index)
    } else {
      this.props.markChecked(this.props.index)
    }
  }

  render() {
    const { author, text, title, work } = this.state
    const inFocus = this.props.id == this.props.inFocus

    if (this.props.deleted) {
      // TODO: Read from state instead
      return <div> </div>
    }

    return (
      <div className={this.props.selected ? 'grid-selected' : 'grid'}>
        <div className="grid-div-button">
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

        <div className="grid-link">
          <Link to={'/note/' + this.props.id}>
            <div className="grid-author">{this.props.author}</div>
            <div className="grid-title">{this.props.title}</div>
            <div className="grid-text">{this.props.text}</div>
          </Link>
        </div>
      </div>
    )
  }
}

export default NoteGrid
