import React from 'react'

// FIXME: Only some auto-completes should have autoFocus on create (Yes: idea, no: author)
class FreeEntry extends React.Component {
  state = {
    currentTypedText: ''
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this), false)
    this.setState({
      currentTypedText: this.props.defaultValue
    })
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
      // Esc
      this.props.escape()
    } else if (event.keyCode == 13) {
      // Enter
      this.props.submit(this.state.currentTypedText)
    }
  }

  update(val) {
    this.setState({ currentTypedText: val.target.value })
  }

  render() {
    // TODO: Validation function

    return (
      <input
        value={this.state.currentTypedText}
        onChange={this.update.bind(this)}
      ></input>
    )
  }
}

export default FreeEntry
