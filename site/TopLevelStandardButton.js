import React from 'react'

export function TopLevelStandardButton(props) {
  let className = 'standard-button'
  switch (props.position) {
    case 'left':
      className += ' left'
      break
    case 'right':
      className += ' right'
      break
    case 'middle':
      className += ' middle'
      break
    case 'hidden':
      className += ' hidden'
      break
    default:
      className += ' left-right'
  }

  return (
    <button
      className={className}
      onClick={props.onClick}
      style={{ userSelect: 'none' }} // Avoids accidentally clicking button text when selecting other text
      type={props.type}
    >
      {props.name ?? props.children}
    </button>
  )
}

export function TopLevelStandardButtonContainer(props) {
  return (
    <div>
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
