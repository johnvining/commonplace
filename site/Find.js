import React from 'react'
import NoteList from './NoteList'
import { searchNotes } from './Database'

class Find extends React.Component {
  state = { search: '' }

  componentDidMount() {
    this.fetchData(this.props.search)
  }

  componentDidUpdate(prevState) {
    if (prevState.search !== this.state.search) {
      this.fetchData(this.state.search)
    }
  }

  fetchData(search) {
    searchNotes(search).then(response => {
      this.setState({ notes: response.data.data })
    })
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.search !== prevState.search) {
      return { search: nextProps.search }
    }

    return null
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
