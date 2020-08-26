import React, { useRef } from 'react'
import { Link, redirectTo } from '@reach/router'

class NoteSlim extends React.Component {
  state = {
    author: ''
  }
  componentDidMount() {
    this.setState({
      authorId: this.props.authorId,
      author: this.props.author,
      work: this.props.work,
      workId: this.props.workId,
      id: this.props.id,
      refetch: this.props.refetch,
      text: this.props.text,
      title: this.props.title,
      inFocus: this.props.inFocus
    })
  }

  render() {
    const {
      author,
      authorId,
      deleted,

      id,
      text,
      title,
      work,
      workId
    } = this.state
    const inFocus = this.props.id == this.props.inFocus

    // If just deleted, hide
    if (deleted) {
      return <div> </div>
    }

    return (
      <Link to={'/note/' + this.props.id} className="note-slim">
        <div
          key={this.props.id}
          id={this.props.id}
          tabIndex={this.props.tabIndex}
          className="note-slim"
        >
          {author?.length ? author : <em>No author</em>} &#8212;{' '}
          {title?.length ? title : <em>No title</em>}
          <br />
          {text?.length ? text : <span>&#8212;</span>}
        </div>
      </Link>
    )
  }
}

export default NoteSlim
