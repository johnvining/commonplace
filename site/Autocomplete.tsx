import React from 'react'
import lightbulb from 'url:./icons/lightbulb.svg'
import loader from 'url:./icons/loader.svg'
import * as constants from './constants'
import { useKeyboardShortcuts, shortcuts } from './KeyboardContext'

class Autocomplete extends React.Component<any, any> {
  state: any = {
    loading: true,
    currentTypedText: '',
    hideResults: false,
    responseIncludesExactMatch: false,
    fetchingIdeaSuggestions: false,
    suggested_ideas: [],
  }
  containerRef = React.createRef<HTMLDivElement>()
  className = this.props.className
  style = {
    searchBox: this.className + ' search-box',
    li: this.className + ' li',
    ul: this.className + ' ul',
    option: this.className + ' option',
    newOption: this.className + ' option new',
  }

  componentDidMount() {
    this.setState({
      currentTypedText: this.props.defaultValue,
      hideResults: true,
    })
  }

  componentWillUnmount() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
  }

  // Section 6: Autocomplete keyboard shortcuts - called from wrapper
  handleKeyboardShortcut(event) {
    // Section 6.1: Navigation
    if (shortcuts.autocomplete.close(event)) {
      if (this.props.onClose) {
        this.props.onClose()
        return true
      }
      if (this.props.escape) this.props.escape()
      this.setState({ currentTypedText: '' })
      return true
    }

    if (shortcuts.autocomplete.back(event) && !this.state.currentTypedText) {
      if (this.props.escape) {
        this.props.escape()
        return true
      }
      return false
    }

    if (event.keyCode === constants.keyCodes.enter) {
      const activeElement = document.activeElement
      const isOption =
        activeElement?.tagName === 'BUTTON' &&
        activeElement?.classList?.contains('option')
      if (isOption) {
        ;(activeElement as HTMLElement).click()
        return true
      }

      const isInputForThis =
        activeElement?.tagName === 'INPUT' &&
        activeElement?.id === this.props.inputName
      if (isInputForThis) {
        return true
      }
    }

    // Section 6.2: AI Suggestions
    if (shortcuts.autocomplete.suggestIdeas(event) && this.props.showSuggestedIdeas) {
      this.handleFetchIdeaSuggestions()
      return true
    }

    return false
  }

  _debounceTimer: ReturnType<typeof setTimeout> | null = null

  handleTypingChange = (val) => {
    this.setState(
      { hideResults: false, currentTypedText: val.target.value },
      () => {
        if (this._debounceTimer) clearTimeout(this._debounceTimer)
        this._debounceTimer = setTimeout(() => this.handleTextUpdate(), 300)
      }
    )
  }

  handleInputKeyDown = (event) => {
    if (event.keyCode === 9) {
      const container = this.containerRef.current
      const firstOption = container?.querySelector('button.option') as HTMLElement | null
      if (firstOption) {
        event.preventDefault()
        event.stopPropagation()
        firstOption.focus()
      }
      return
    }

    if (event.keyCode === constants.keyCodes.enter) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  handleOptionKeyDown = (event) => {
    if (event.keyCode === constants.keyCodes.enter) {
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.click()
      return
    }

    if (event.keyCode !== 9) {
      return
    }
    const container = this.containerRef.current
    const options = Array.from(
      container?.querySelectorAll('button.option') || []
    ) as HTMLElement[]
    if (!options.length) {
      return
    }
    const currentIndex = options.indexOf(event.currentTarget)
    if (currentIndex === -1) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const direction = event.shiftKey ? -1 : 1
    const nextIndex =
      (currentIndex + direction + options.length) % options.length
    options[nextIndex].focus()
  }

  handleTextUpdate = () => {
    if (!this.state.currentTypedText) {
      if (this.props.onClearText) this.props.onClearText()
      return
    } else if (this.state.currentTypedText.length < 3) {
      this.setState({ responses: [] })
      return
    }
    this.props
      .getSuggestions(this.props.apiType, this.state.currentTypedText)
      .then((response) => {
        let options = response.data.data
        let hasExact = false
        for (let i = 0; i < options.length; i++) {
          if (this.state.currentTypedText == options[i].name) {
            hasExact = true
            break
          }
        }
        if (this.props.excludeIds) {
          options = options.filter(
            (item) => !this.props.excludeIds.includes(item._id)
          )
        }

        if (this.props.excludeNames) {
          options = options.filter(
            (item) => !this.props.excludeNames.includes(item.name)
          )
        }
        this.setState({
          responses: options,
          responseIncludesExactMatch: hasExact,
        })
      })
      .catch((error) => {
        console.error(error)
      })
  }

  handleFetchIdeaSuggestions = () => {
    this.setState({ fetchingIdeaSuggestions: true, hideResults: true })
    this.props.getIdeaSuggestions().then((response) => {
      let suggested_ideas = response.data.suggested_ideas
      if (this.props.excludeNames) {
        suggested_ideas = suggested_ideas.filter(
          (item) => !this.props.excludeNames.includes(item)
        )
      }
      this.setState({
        fetchingIdeaSuggestions: false,
        suggested_ideas: suggested_ideas,
      })
    })
  }

  handleOptionSelect = (val) => {
    if (val?.preventDefault) {
      val.preventDefault()
    }
    if (val?.stopPropagation) {
      val.stopPropagation()
    }
    const selectedId = val.target.id || val.target.getAttribute('data-id')
    const selectedName = val.target.name || val.target.getAttribute('data-name')
    this.setState(
      {
        currentTypedText: selectedName,
        selectedId: selectedId,
        hideResults: true,
      },
      () => {
        this.props.onSelect(this.state.selectedId, this.state.currentTypedText)
        const input = document.getElementById(this.props.inputName) as HTMLInputElement | null
        if (input) {
          input.value = this.state.currentTypedText
        }
      }
    )

    if (this.props.clearOnSelect) {
      ;(document.getElementById(this.props.inputName) as HTMLInputElement).value = ''
      ;(document.getElementById(this.props.inputName) as HTMLInputElement).focus()
      this.setState({ currentTypedText: '' })
    }
  }

  handleSuggestionSelect = (val) => {
    this.setState(
      {
        currentTypedText: val.target.name,
        hideResults: false,
      },
      () => {
        this.handleTextUpdate()
      }
    )
  }

  handleNewSelect = () => {
    this.props.handleNewSelect(this.state.currentTypedText)
    this.setState({ hideResults: true })
    if (this.props.clearOnSelect) {
      ;(document.getElementById(this.props.inputName) as HTMLInputElement).value = ''
      ;(document.getElementById(this.props.inputName) as HTMLInputElement).focus()
      this.setState({ currentTypedText: '' })
    } else {
      ;(document.getElementById(this.props.inputName) as HTMLInputElement).value =
        this.state.currentTypedText
    }
  }

  render() {
    const { responses } = this.state
    return (
      <div
        className={this.props.className + ' autocomplete-div'}
        ref={this.containerRef}
      >
        {this.props.showSuggestedIdeas ? (
          <button
            className={'button action-button'}
            tabIndex={-1}
            onClick={() => {
              this.handleFetchIdeaSuggestions()
            }}
          >
            {this.state.fetchingIdeaSuggestions ? (
              <img src={loader}></img>
            ) : (
              <img src={lightbulb}></img>
            )}
          </button>
        ) : (
          ''
        )}
        <input
          id={this.props.inputName}
          autoFocus={this.props.dontAutofocus ? false : true}
          className={this.style.searchBox}
          data-allow-shortcuts="true"
          value={this.state.currentTypedText || ''}
          onChange={this.handleTypingChange.bind(this)}
          onKeyDown={this.handleInputKeyDown}
        ></input>
        {this.state.hideResults ? (
          <>
            {/* Generated Options */}
            {this.state.suggested_ideas != null ? (
              <ul className={this.style.ul}>
                {this.state.suggested_ideas?.map((val) => {
                  return (
                    <li key={val} className={this.style.li}>
                      <button
                        id={val}
                        name={val}
                        className={this.style.option}
                        onClick={this.handleSuggestionSelect.bind(this)}
                      >
                        {val}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              ''
            )}
          </>
        ) : (
          <>
            {/* Options */}
            <ul className={this.style.ul}>
              {responses?.map((res) => {
                const optionId = res?._id || res?.id
                return (
                  <li key={optionId} className={this.style.li}>
                    <button
                      id={optionId}
                      data-id={optionId}
                      name={res.name}
                      data-name={res.name}
                      className={this.style.option}
                      onClick={this.handleOptionSelect.bind(this)}
                      onKeyDown={this.handleOptionKeyDown}
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
                    onKeyDown={this.handleOptionKeyDown}
                  >
                    {this.state.currentTypedText}
                  </button>
                </li>
              ) : null}
            </ul>
          </>
        )}
      </div>
    )
  }
}

// Wrapper component that provides keyboard shortcuts
function AutocompleteWithKeyboard(props: any) {
  const autocompleteRef = React.useRef<Autocomplete | null>(null)

  // Section 6: Autocomplete keyboard shortcuts
  useKeyboardShortcuts(
    constants.keyboardScopes.AUTOCOMPLETE,
    (event) => {
      if (!autocompleteRef.current) return false
      return autocompleteRef.current.handleKeyboardShortcut(event)
    },
    []
  )

  return <Autocomplete ref={autocompleteRef} {...props} />
}

export default AutocompleteWithKeyboard
