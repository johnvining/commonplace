function ClickableLabelButton({ onClick, children, className = '', ...props }: any) {
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
