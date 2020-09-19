import React from 'react'

class Autocomplete extends React.Component {
  state = {
    loading: true,
    currentTypedText: '',
    hideResults: false
  }
  className = this.props.className
  style = {
    searchBox: this.className + ' label',
    li: this.className + ' li',
    ul: this.className + ' ul',
    option: this.className + ' option',
    newOption: this.className + ' option new'
  }

  componentDidMount() {
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)
    this.setState({
      currentTypedText: this.props.defaultValue,
      hideResults: true
    })
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.keyDownListener, false)
  }

  handleKeyDown(event) {
    if (event.keyCode == 27) {
      this.props.escape()
      this.setState({ currentTypedText: '' })
    } else if (event.keyCode == 8 && !this.state.currentTypedText) {
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
          console.error(error)
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
        this.props.onSelect(this.state.selectedID, this.state.currentTypedText)
        document.getElementById(
          this.props.inputName
        ).value = this.state.currentTypedText
      }
    )

    if (this.props.clearOnSelect) {
      document.getElementById(this.props.inputName).value = ''
      document.getElementById(this.props.inputName).focus()
      this.setState({ currentTypedText: '' })
    }
  }

  handleNewSelect = val => {
    this.props.handleNewSelect(this.state.currentTypedText)
    this.setState({ hideResults: true })
    if (this.props.clearOnSelect) {
      document.getElementById(this.props.inputName).value = ''
      document.getElementById(this.props.inputName).focus()
      this.setState({ currentTypedText: '' })
    } else {
      document.getElementById(
        this.props.inputName
      ).value = this.state.currentTypedText
    }
  }

  render() {
    const { responses } = this.state
    return (
      <div className={this.props.className + ' autocomplete'}>
        <input
          id={this.props.inputName}
          autoFocus={this.props.dontAutofocus ? false : true}
          className={this.style.searchBox}
          value={this.state.currentTypedText}
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
