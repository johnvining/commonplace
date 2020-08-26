import React, { useRef } from 'react'
import { Link, redirectTo } from '@reach/router'

class NoteSlim extends React.Component {
  state = {}

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
    const { author, text, title, work } = this.state
    const inFocus = this.props.id == this.props.inFocus

    return (
      <Link to={'/note/' + this.props.id} className="note-slim">
        <div tabIndex={this.props.tabIndex} className="note-slim">
          {author?.length ? author : <em>No author</em>}
          {work?.length ? <em>,&nbsp;&nbsp;{work}</em> : null}
          &nbsp;&nbsp;&#8212;&nbsp; {title?.length ? title : <em>No title</em>}
          <br />
          {text?.length ? text : <span>&#8212;</span>}
        </div>
      </Link>
    )
  }
}

export default NoteSlim
