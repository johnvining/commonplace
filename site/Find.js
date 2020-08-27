import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'

class Find extends React.Component {
  state = { loading: true }

  componentDidMount() {
    this.setState({ search: this.props.search })
    db.search(this.props.search).then(response => {
      this.setState({ notes: response.data.data })
    })
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.search !== prevState.search) {
      return { search: nextProps.search }
    }

    return null
  }

  componentDidUpdate(prevState, prevProps) {
    if (prevState.search !== this.state.search) {
      db.search(this.state.search).then(response => {
        this.setState({ notes: response.data.data })
      })
    }
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
