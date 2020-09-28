import React from 'react'

class NoteAuthorSpan extends React.Component {
  render() {
    return (
      <>
        {this.props.note.author?.name?.length ? (
          this.props.note.author.name
        ) : this.props.note.work?.author?.name.length ? (
          <>{this.props.note.work.author.name}</>
        ) : (
          'no author'
        )}
      </>
    )
  }
}

export default NoteAuthorSpan
