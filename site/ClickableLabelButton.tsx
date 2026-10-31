import { withShortcut } from './TopLevelStandardButton'

function ClickableLabelButton({ onClick, children, className = '', shortcut, ...props }: any) {
  return (
    <span
      className={`clickable-label-button ${className}`}
      onClick={onClick}
      title={withShortcut(typeof children === 'string' ? children : undefined, shortcut)}
      {...props}
    >
      {children}
    </span>
  )
}

export default ClickableLabelButton
