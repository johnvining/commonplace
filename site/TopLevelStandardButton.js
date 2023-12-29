import React from 'react'

function TopLevelStandardButton(props) {
  return (
    <button
      className="top-level standard-button left-right"
      onClick={props.onClick}
    >
      {props.name}
    </button>
  )
}

export default TopLevelStandardButton
