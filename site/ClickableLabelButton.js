import React from 'react'

function ClickableLabelButton({ onClick, children, className = '', ...props }) {
  return (
    <span
      className={`clickable-label-button ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </span>
  )
}

export default ClickableLabelButton
