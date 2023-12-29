import React from 'react'

export function TopLevelFormInput(props) {
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
