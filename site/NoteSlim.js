import React from 'react'
import { Link } from 'react-router-dom'
import circle from './icons/circle.svg'
import check_circle from './icons/check_circle.svg'
import NoteAuthorSpan from './NoteAuthorSpan'

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
          this.props.selected ? 'note-slim outer selected' : 'note-slim outer'
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
              <div className="note-slim inner">
                <NoteAuthorSpan note={this.props.note} separator=": " />

                <b>
                  {this.props.note.title?.length ? (
                    this.props.note.title
                  ) : (
                    <em>no title</em>
                  )}
                </b>
              </div>
              <div className="note-slim inner">
                {this.props.note.images?.length > 0
                  ? '[' +
                    this.props.note.images?.length +
                    ' image' +
                    (this.props.note.images?.length == 1 ? '' : 's') +
                    '] '
                  : null}
                {this.props.note.text?.length ? (
                  <>{this.props.note.text}</>
                ) : null}
                {this.props.note.work?.name.length ? (
                  <em>&nbsp;&nbsp;{this.props.note.work.name}</em>
                ) : null}
              </div>

              <div className="note-slim inner">
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
              <div></div>
            </div>
          </Link>
        </div>
      </div>
    )
  }
}

export default NoteSlim
