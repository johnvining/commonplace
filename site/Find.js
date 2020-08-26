import React from 'react'
import axios from 'axios'
import NoteList from './NoteList'
import { decodeBase64 } from 'bcryptjs'
import * as db from './Database'

// TODO: Clean up all URLs
// TODO: Fix going author -> author now that it's possible with search bar
class Find extends React.Component {
  state = { loading: true }

  componentDidMount() {
    db.search(this.props.search).then(response => {
      this.setState({ notes: response.data.data })
    })
  }

  // TODO: Split up note page and note display so I can use the note diplsay here
  // TODO: Better formatting for author name
  // TODO: Way to do this without two database calls?
  render() {
    return (
      <div>
        <div align="right">
          <span className="title"></span>
        </div>

        <NoteList notes={this.state.notes} useSlim={true} />
      </div>
    )
  }
}

export default Find
