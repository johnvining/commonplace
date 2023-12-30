import React from 'react'
import Autocomplete from './Autocomplete'

export function TopLevelFormInput(props) {
  // TODO: These are all italic because of the title
  return (
    <>
      <label htmlFor={props.id} className="work-page form-label">
        {props.name}
      </label>
      <input
        className="work-page title input"
        id={props.id}
        defaultValue={props.defaultValue}
        onChange={props.onChange}
        type={props.type}
      />
    </>
  )
}

export function TopLevelFormTextArea(props) {
  return (
    <>
      <label htmlFor={props.id} className="work-page form-label">
        {props.name}
      </label>
      <textarea
        id={props.id}
        className={'work-page importText input'}
        value={props.value}
        onChange={props.onChange}
      ></textarea>
    </>
  )
}

export function TopLevelFormAutocomplete(props) {
  return (
    <>
      <label htmlFor={props.id} className="work-page form-label">
        {props.name}
      </label>
      {/* TODO: Generalize classname */}
      <Autocomplete
        inputName={props.id}
        className="work-page author-select"
        dontAutofocus={props.dontAutofocus}
        defaultValue={props.defaultValue}
        onSelect={props.onSelect}
        getSuggestions={props.getSuggestions}
        apiType={props.apiType}
        handleNewSelect={props.handleNewSelect}
        onClearText={props.onClearText}
      />
    </>
  )
}

export function TopLevelFormContainer(props) {
  return <div className="top-level-form">{props.children}</div>
}