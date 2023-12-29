import React from 'react'

function TopLevelStandardButton(props) {
  return (
    <button
      className="top-level standard-button left-right"
      onClick={props.onClick}
      style={{ userSelect: 'none' }} // Avoids accidentally clicking button text when selecting other text
    >
      {props.name}
    </button>
  )
}

export default TopLevelStandardButton
