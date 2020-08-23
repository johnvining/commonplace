import React from 'react'
import axios from 'axios'
import Note from './Note'
import { Link } from '@reach/router'
import * as db from './Database'

class Autocomplete extends React.Component {
  state = { loading: true, currentTypedText: '', hideResults: false }
  className = this.props.className
  style = {
    searchBox: this.className + '-search-box',
    li: this.className + '-li',
    ul: this.className + '-ul',
    option: this.className + '-option',
    newOption: this.className + '-option-new',
    exitButton: this.className + '-exit-button',
    exitButtonImage: this.props.exitButtonImage
  }

  // TODO: Support for different databases
  // TODO: Support for filtering what we already have

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)
    this.setState({ currentTypedText: this.props.default })
  }

  componentWillUnmount() {
    document.removeEventListener(
      'keydown',
      this.handleKeyDown.bind(this),
      false
    )
  }

  handleKeyDown(event) {
    if (event.keyCode == 27) {
      this.props.escape()
    }
  }

  handleTypingChange = val => {
    this.setState({ hideResults: false })
    this.setState({ currentTypedText: val.target.value }, () => {
      if (this.state.currentTypedText.length < 3) {
        this.state.responses = []
        return
      }
      this.props
        .getSuggestions(this.state.currentTypedText)
        .then(response => {
          this.setState({
            responses: response.data.data
          })
        })
        .catch(error => {
          console.log(error)
        })
    })
  }

  handleOptionSelect = val => {
    this.setState(
      {
        currentTypedText: val.target.name,
        selectedID: val.target.id,
        hideResults: true
      },
      () => {
        this.props.onSelect(this.state.selectedID)
      }
    )
  }

  handleNewSelect = val => {
    this.props.handleNewSelect(this.state.currentTypedText)
    this.setState({ hideResults: true })
  }

  render() {
    const { responses } = this.state
    return (
      <div className="nothing">
        <input
          autoFocus
          id="mainInput"
          value={this.state.currentTypedText}
          className={this.style.searchBox}
          onChange={this.handleTypingChange.bind(this)}
        ></input>
        {this.state.hideResults ? (
          <span></span>
        ) : (
          <ul className={this.style.ul}>
            {responses?.map(res => {
              return (
                <li key={res._id} className={this.style.li}>
                  <button
                    id={res._id}
                    name={res.name}
                    className={this.style.option}
                    onClick={this.handleOptionSelect.bind(this)}
                  >
                    {res.name}
                  </button>
                </li>
              )
            })}
            {this.state.currentTypedText?.length > 0 ? (
              <li key="_new-li" className={this.style.li}>
                <button
                  id="_new"
                  name="New"
                  className={this.style.newOption}
                  onClick={this.handleNewSelect.bind(this)}
                >
                  {this.state.currentTypedText}
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    )
  }
}

export default Autocomplete
