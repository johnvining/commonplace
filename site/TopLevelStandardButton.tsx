import ClickToCopyNick from './ClickToCopyNick'

// Hover text for a button: its label plus its keyboard shortcut, e.g.
// "Edit (Ctrl+E)". Every button with a shortcut passes it this way.
export function withShortcut(label?: string, shortcut?: string) {
  if (!shortcut) return label
  return label ? `${label} (${shortcut})` : shortcut
}

export function TopLevelStandardButton(props: any) {
  let className = 'button'
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
  if (props.className) {
    className += ` ${props.className}`
  }

  return (
    <button
      className={className}
      onClick={props.onClick}
      style={{ userSelect: 'none' }} // Avoids accidentally clicking button text when selecting other text
      type={props.type}
      // For icon-only buttons: accessible name. The tooltip adds the
      // shortcut, if any.
      aria-label={props.label}
      aria-keyshortcuts={props.shortcut}
      title={withShortcut(props.label ?? (typeof props.name === 'string' ? props.name : undefined), props.shortcut)}
    >
      {props.name ?? props.children}
    </button>
  )
}

export function TopLevelStandardButtonContainer(props: any) {
  const containerClassName = props.className
    ? `top-level-button-container ${props.className}`
    : 'top-level-button-container'
  return (
    <div className={containerClassName}>
      {props.children}{' '}
      {props.nick ? (
        <ClickToCopyNick nick={props.nick} style={{ marginLeft: '10px' }} />
      ) : null}
    </div>
  )
}

// Icon button in a note's action bar (#302). `label` is its accessible
// name and, with `shortcut`, its tooltip (the buttons are icon-only).
// `tabbable` decides
// whether Tab stops on it: only on the note being worked on, so Tab
// moves between notes otherwise.
export function NoteButton(props: {
  icon: string
  label: string
  shortcut?: string
  onClick?: (e: any) => void
  tabbable?: boolean
}) {
  return (
    <button
      type="button"
      className="button action-button"
      onClick={props.onClick}
      aria-label={props.label}
      aria-keyshortcuts={props.shortcut}
      title={withShortcut(props.label, props.shortcut)}
      tabIndex={props.tabbable === false ? -1 : undefined}
    >
      <img src={props.icon} alt="" />
    </button>
  )
}
