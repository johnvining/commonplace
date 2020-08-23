import React from 'react'
import axios from 'axios'
import Note from './Note'

class RecentList extends React.Component {
  state = { loading: true }

  componentDidMount() {
    console.log('mount')
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

  componentWillUpdate() {
    console.log('list update')
  }

  // TODO: Split up note page and note display so I can use the note diplsay here
  // TODO: Better formatting for author name
  // TODO: Way to do this without two database calls?
  render() {
    return (
      <div>
        {this.state.notes === undefined ? (
          <h2>Nothing</h2>
        ) : (
          <div>
            {this.state.notes.map(note => {
              return (
                <Note
                  title={note.title}
                  author={note.author?.name}
                  authorId={note.author?._id}
                  text={note.text}
                  ideas={note.ideas}
                  _id={note._id}
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
