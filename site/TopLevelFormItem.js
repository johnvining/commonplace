import React from 'react'

function TopLevelFormItem(props) {
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

export default TopLevelFormItem
