import React from 'react'
import axios from 'axios'
import NoteList from './NoteList'
import { decodeBase64 } from 'bcryptjs'
import * as db from './Database'

// TODO: Fix going search -> search
class Find extends React.Component {
  state = { loading: true }

  componentDidMount() {
    db.search(this.props.search).then(response => {
      this.setState({ notes: response.data.data })
    })
  }

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
