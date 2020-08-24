import React from 'react'
import Note from './Note'
import * as db from './Database'

class Work extends React.Component {
  state = { loading: true, newId: false }

  // TODO: Clean up -- https://stackoverflow.com/questions/48139281/react-doesnt-reload-component-data-on-route-param-change-or-query-change
  // TODO: DRY
  // TODO: Adding ideas doesn't refresh automatically
  componentDidMount() {
    db.getNotesForWork(this.props.id)
      .then(response => {
        this.setState({
          notes: response.data.data
        })
      })
      .catch(error => {
        console.error(error)
      })
    db.getWorkInfo(this.props.id)
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
        db.getNotesForWork(this.props.id)
          .then(response => {
            this.setState({
              notes: response.data.data
            })
          })
          .catch(error => {
            console.error(error)
          })
        db.getWorkInfo(this.props.id)
          .then(response => {
            this.setState({
              workName: response.data.data.name
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

        {this.state.notes === undefined ? null : (
          <div>
            {this.state.notes.map(note => {
              return (
                <Note
                  key={'note-' + note._id}
                  title={note.title}
                  author={note.author?.name}
                  authorId={note.author?._id}
                  text={note.text}
                  ideas={note.ideas}
                  id={note._id}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }
}

export default Work
