import React from 'react'

class Autocomplete extends React.Component {
  state = {
    loading: true,
    currentTypedText: '',
    hideResults: false,
    responseIncludesExactMatch: false
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
      if (this.props.escape) this.props.escape()
      this.setState({ currentTypedText: '' })
    } else if (event.keyCode == 8 && !this.state.currentTypedText) {
      if (this.props.escape) this.props.escape()
    }
  }

  handleTypingChange = val => {
    this.setState({ hideResults: false })
    this.setState({ currentTypedText: val.target.value }, () => {
      if (!this.state.currentTypedText) {
        if (this.props.onClearText) this.props.onClearText()
        return
      } else if (this.state.currentTypedText.length < 3) {
        this.state.responses = []
        return
      }
      this.props
        .getSuggestions(this.props.apiType, this.state.currentTypedText)
        .then(response => {
          var options = response.data.data
          for (var i = 0; i < options.length; i++) {
            var hasExact = false
            if (this.state.currentTypedText == options[i].name) {
              hasExact = true
              break
            }
          }
          if (this.props.excludeIds) {
            options = options.filter(
              item => !this.props.excludeIds.includes(item._id)
            )
          }
          this.setState({
            responses: options,
            responseIncludesExactMatch: hasExact
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
        selectedId: val.target.id,
        hideResults: true
      },
      () => {
        this.props.onSelect(this.state.selectedId, this.state.currentTypedText)
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
      <div className={this.props.className + ' autocomplete-div'}>
        <input
          id={this.props.inputName}
          autoFocus={this.props.dontAutofocus ? false : true}
          className={this.style.searchBox}
          value={this.state.currentTypedText || ''}
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
            {this.state.currentTypedText?.length > 0 &&
            !this.state.responseIncludesExactMatch ? (
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
