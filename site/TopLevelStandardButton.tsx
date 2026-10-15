import ClickToCopyNick from './ClickToCopyNick'

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
// name and tooltip (the buttons are icon-only). `tabbable` decides
// whether Tab stops on it: only on the note being worked on, so Tab
// moves between notes otherwise.
export function NoteButton(props: {
  icon: string
  label: string
  onClick?: (e: any) => void
  tabbable?: boolean
}) {
  return (
    <button
      type="button"
      className="button action-button"
      onClick={props.onClick}
      aria-label={props.label}
      title={props.label}
      tabIndex={props.tabbable === false ? -1 : undefined}
    >
      <img src={props.icon} alt="" />
    </button>
  )
}
