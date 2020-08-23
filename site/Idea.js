import React from 'react'
import axios from 'axios'
import Note from './Note'

class Idea extends React.Component {
  state = { loading: true }

  // TODO: Clean up -- https://stackoverflow.com/questions/48139281/react-doesnt-reload-component-data-on-route-param-change-or-query-change
  // TODO: DRY
  // TODO: Fix infinite loop
  componentDidMount() {
    let url = `http://localhost:3000/api/idea/${this.props.id}/notes`
    console.log(url)
    console.log(this.props)
    axios
      .get(url)
      .then(response => {
        console.log('response')
        console.log(response)
        this.setState({
          notes: response.data.data
        })

        console.log(this.state.notes[0]._id)
      })
      .catch(error => {
        console.log(error)
      })
  }

  componentDidUpdate() {
    let url = `http://localhost:3000/api/idea/${this.props.id}/notes`
    console.log(url)
    console.log(this.props)
    axios
      .get(url)
      .then(response => {
        console.log('response')
        console.log(response)
        this.setState({
          notes: response.data.data
        })
      })
      .catch(error => {
        console.log(error)
      })
  }

  // let authorUrl = `http://localhost:3000/api/auth/${this.props.id}`
  // console.log(authorUrl)
  // axios
  //   .get(authorUrl)
  //   .then(response => {
  //     console.log('response')
  //     console.log(response)
  //     this.setState({
  //       authorName: response.data.data.name,
  //       bornYear: response.data.data.bornYear,
  //       diedYear: response.data.data.diedYear
  //     })

  //     console.log(this.state.notes[0]._id)
  //   })
  //   .catch(error => {
  //     console.log(error)
  //   })

  render() {
    return (
      <div>
        <div align="right">
          {/* <span className="title">
            <small>
              <small>{this.state.ideaName}</small>
            </small>
          </span> */}
          hi
        </div>

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

export default Idea
