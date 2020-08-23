import React from 'react'
import axios from 'axios'
import Note from './Note'
import { Link } from '@reach/router'
import { decodeBase64 } from 'bcryptjs'
import * as db from './Database'

class NoteView extends React.Component {
  state = {}

  constructor(props) {
    super(props)
  }

  getNoteData() {
    db.getNoteInfo(this.props.id)
      .then(response => {
        const data = response.data.data
        this.setState({
          author: data.author?.name,
          authorId: data.author?._id,
          text: data.text,
          title: data.title,
          ideas: data.ideas
        })

        document.title = this.state.title
      })
      .catch(error => {
        console.log(error)
      })
  }

  componentDidMount() {
    this.getNoteData()
  }

  refetch() {
    this.getNoteData()
  }

  render() {
    console.log('NoteView Render ' + this.state.author)
    return (
      <Note
        title={this.state.title}
        author={this.state.author}
        authorId={this.state.author?._id}
        text={this.state.text}
        ideas={this.state.ideas}
        id={this.props.id}
        refetch={this.refetch.bind(this)}
      />
    )
  }
}

export default NoteView
