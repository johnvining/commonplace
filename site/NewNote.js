import React from 'react'
import axios from 'axios'
import Note from './Note'
import { Link } from '@reach/router'

class NewNote extends React.Component {
  state = { loading: true }

  componentWillMount() {
    this.setState({ edit: true })
    // console.log('did mnt')
    // console.log(this.props.id)
    // let url = `http://localhost:3000/api/note/${this.props.id}`
    // console.log(url)
    // axios
    //   .get(url)
    //   .then(response => {
    //     this.setState({
    //       title: response.data.data.title,
    //       text: response.data.data.text,
    //       author: response.data.data.author?.name,
    //       authorId: response.data.data.author._id
    //     })
    //     document.title = this.state.title
    //   })
    //   .catch(error => {
    //     console.log(error)
    //   })
  }

  render() {
    const { edit } = this.state
    console.log('this edit ' + edit)
    return <Note edit={edit} />
  }
}

export default NewNote
