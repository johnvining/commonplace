import React from 'react'
import * as constants from './constants'

class FreeEntry extends React.Component {
  state = {
    currentTypedText: '',
  }

  componentDidMount() {
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)
    this.setState({
      currentTypedText: this.props.defaultValue,
    })
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keyDownListener, false)
  }

  handleKeyDown(event) {
    if (event.keyCode == constants.keyCodes.esc) {
      this.props.escape()
    } else if (event.keyCode == constants.keyCodes.enter) {
      this.props.submit(this.state.currentTypedText)
    }
  }

  update(val) {
    this.setState({ currentTypedText: val.target.value })
  }

  render() {
    return (
      <input
        value={this.state.currentTypedText}
        onChange={this.update.bind(this)}
      ></input>
    )
  }
}

export default FreeEntry
