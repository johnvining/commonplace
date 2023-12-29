import React from 'react'

export function TopLevelStandardButton(props) {
  return (
    <button
      className="top-level standard-button left-right"
      onClick={props.onClick}
      style={{ userSelect: 'none' }} // Avoids accidentally clicking button text when selecting other text
      type={props.type}
    >
      {props.name}
    </button>
  )
}

export function TopLevelStandardButtonContainer(props) {
  return (
    <div className="standard-button-container">
      {props.children}{' '}
      {props.nick ? (
        <div style={{ display: 'inline', marginLeft: '10px' }}>
          <code style={{ color: 'grey' }}>
            <small>{props.nick}</small>
          </code>
        </div>
      ) : null}
    </div>
  )
}
