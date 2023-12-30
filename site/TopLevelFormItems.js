import React from 'react'
import Autocomplete from './Autocomplete'

export function TopLevelFormInput(props) {
  return (
    <>
      <label htmlFor={props.id} className="top-level form-label">
        {props.name}
      </label>
      <input
        className="top-level input"
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
      <label htmlFor={props.id} className="top-level form-label">
        {props.name}
      </label>
      <textarea
        id={props.id}
        className={'top-level textarea input'}
        value={props.value}
        onChange={props.onChange}
      ></textarea>
    </>
  )
}

export function TopLevelFormAutocomplete(props) {
  return (
    <>
      <label htmlFor={props.id} className="top-level form-label">
        {props.name}
      </label>
      {/* TODO: Generalize classname */}
      <Autocomplete
        inputName={props.id}
        className="top-level author-select"
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
  return <div>{props.children}</div>
}
