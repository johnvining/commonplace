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
          notes: data
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
    return <NoteList notes={this.state.notes} />
  }
}

export default NoteView
