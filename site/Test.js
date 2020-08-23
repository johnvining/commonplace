import React from 'react'
import axios from 'axios'
import Note from './Note'
import { Link } from '@reach/router'
import Autocomplete from './Autocomplete'

class Test extends React.Component {
  state = { loading: true }

  componentDidMount() {
    console.log('Test mounts')
  }

  whenSelected(val) {
    console.log('from test')
    console.log(val)
  }

  render() {
    return (
      <div>
        <Autocomplete onSelect={this.whenSelected} />
      </div>
    )
  }
}

export default Test
