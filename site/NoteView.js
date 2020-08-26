import React from 'react'
import axios from 'axios'
import NoteList from './NoteList'
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
    this.getNoteData() // TODO: Can we skip the re-fetch?
  }

  render() {
    const note = {
      title: this.state.title,
      author: this.state.author,
      authorId: this.state.authorId,
      text: this.state.text,
      ideas: this.state.ideas,
      id: this.props.id
    }

    return <NoteList notes={[note]} />
  }
}

export default NoteView
