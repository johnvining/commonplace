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
          author: data.author,
          ideas: data.ideas,
          text: data.text,
          title: data.title,
          work: data.work
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
    console.log(this.state)

    const note = {
      _id: this.props.id,
      author: this.state.author,
      authorId: this.state.authorId,
      ideas: this.state.ideas,
      text: this.state.text,
      title: this.state.title,
      work: this.state.work,
      workId: this.state.workId
    }

    return <NoteList notes={[note]} />
  }
}

export default NoteView
