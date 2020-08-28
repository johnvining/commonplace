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

  markChecked() {
    this.props.markChecked(this.props.id)
  }

  render() {
    const { author, text, title, work } = this.state
    const inFocus = this.props.id == this.props.inFocus

    if (this.props.deleted) {
      // TODO: Read from state instead
      return <div> </div>
    }

    return (
      <div className={this.props.selected ? 'slim-selected' : 'slim'}>
        <button onClick={this.markChecked.bind(this)}>Mark</button>

        <Link to={'/note/' + this.props.id} className="note-slim">
          <div tabIndex={this.props.tabIndex} className="note-slim">
            <b>{title?.length ? title : <em>No title</em>}</b>
            <br />
            {text?.length ? text : <span>&#8212;</span>}
            <br />
            <div align="right">
              {author?.length ? author : <em>No author</em>}
              {work?.length ? <em>,&nbsp;&nbsp;{work}</em> : null}
            </div>
          </div>
        </Link>
      </div>
    )
  }
}

export default NoteSlim
