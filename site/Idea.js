import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'

class Idea extends React.Component {
  state = { loading: true, newId: false }

  // TODO: Clean up -- https://stackoverflow.com/questions/48139281/react-doesnt-reload-component-data-on-route-param-change-or-query-change
  // TODO: DRY
  // TODO: Adding ideas doesn't refresh automatically
  componentDidMount() {
    db.getNotesForIdea(this.props.id)
      .then(response => {
        this.setState({
          notes: response.data.data
        })
      })
      .catch(error => {
        console.error(error)
      })
    db.getIdeaInfo(this.props.id)
      .then(response => {
        this.setState({
          ideaName: response.data.data.name
        })
      })
      .catch(error => {
        console.error(error)
      })
  }

  componentDidUpdate() {
    if (this.state.newId) {
      this.setState({ newId: false }, () => {
        db.getNotesForIdea(this.props.id)
          .then(response => {
            this.setState({
              notes: response.data.data
            })
          })
          .catch(error => {
            console.error(error)
          })
        db.getIdeaInfo(this.props.id)
          .then(response => {
            this.setState({
              ideaName: response.data.data.name
            })
          })
          .catch(error => {
            console.error(error)
          })
      })
    }
  }

  static getDerivedStateFromProps(next, prev) {
    if (next.id != prev.id) {
      return {
        id: next.id,
        newId: true
      }
    }
    return next
  }

  render() {
    return (
      <div>
        <div align="right">
          <span className="title">{this.state.ideaName}</span>
        </div>

        <NoteList notes={this.state.notes} useSlim={this.props.slim} />
      </div>
    )
  }
}

export default Idea
