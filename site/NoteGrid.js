import React from 'react'
import { Link } from 'react-router-dom'
import circle from './icons/circle.svg'
import check_circle from './icons/check_circle.svg'
import * as db from './Database'

class NoteGrid extends React.Component {
  state = {}

  componentDidMount() {
    db.getNoteNick(this.props.id).then((response) => {
      this.setState({ nick: response.data.data.key })
    })
  }

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
            <div className="grid-nick">
              {this.state.nick}
              <span className="grid-unprintable">|</span>
            </div>
            <div className="grid-author">
              {this.props.author}
              <span className="grid-unprintable">|</span>
            </div>
            <div className="grid-title">
              {this.props.title}
              <span className="grid-unprintable">|</span>
            </div>
            <div className="grid-text">
              {this.props.imageCount > 0
                ? '[' +
                  this.props.imageCount +
                  ' image' +
                  (this.props.imageCount == 1 ? '' : 's') +
                  '] '
                : null}
              {this.props.text}
            </div>
          </Link>
        </div>
      </div>
    )
  }
}

export default NoteGrid
