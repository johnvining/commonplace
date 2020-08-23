import React from 'react'
import axios from 'axios'
import Note from './Note'

class RecentList extends React.Component {
  state = { loading: true }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)

    // TODO: Replace with call to db.
    let url = `http://localhost:3000/api/note/all`
    axios
      .get(url)
      .then(response => {
        this.setState({
          notes: response.data.data
        })

        document.title = 'Commonplace'
      })
      .catch(error => {
        console.log(error)
      })
  }

  componentWillUnmount() {
    document.removeEventListener(
      'keydown',
      this.handleKeyDown.bind(this),
      false
    )
  }

  // FIXME: Keyboard shortcuts apply to all notes on the page, rather than a specific one. Way of selecting a note-focus on lists?
  handleKeyDown(event) {
    // TODO: Keyboard short cuts will interfere with Ctrl + A on Windows
    console.log('recent' + event)
    if (event.keyCode == 13) {
      this.setIsFocused(document.activeElement.id)
    }
  }

  setIsFocused(id) {
    this.setState({
      inFocus: id
    })
  }

  // TODO: Split up note page and note display so I can use the note diplsay here
  // TODO: Better formatting for author name
  render() {
    return (
      <div>
        {this.state.notes === undefined ? null : (
          <div>
            {this.state.notes.map((note, index) => {
              return (
                <Note
                  key={note._id}
                  title={note.title}
                  author={note.author?.name}
                  authorId={note.author?._id}
                  text={note.text}
                  ideas={note.ideas}
                  id={note._id}
                  tabIndex={index + 1}
                  inFocus={this.state.inFocus}
                />
              )
            })}
          </div>
        )}
      </div>
    )
  }
}

export default RecentList
