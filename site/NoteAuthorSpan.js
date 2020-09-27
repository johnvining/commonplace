import React from 'react'

class NoteAuthorSpan extends React.Component {
  render() {
    return (
      <span className="author">
        {this.props.note.author?.name?.length ? (
          this.props.note.author.name
        ) : this.props.note.work?.author?.name.length ? (
          <>{this.props.note.work.author.name}</>
        ) : (
          'no author'
        )}
      </span>
    )
  }
}

export default NoteAuthorSpan
