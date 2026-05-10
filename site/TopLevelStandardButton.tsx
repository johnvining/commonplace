import ClickToCopyNick from './ClickToCopyNick'

export function TopLevelStandardButton(props) {
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

export function TopLevelStandardButtonContainer(props) {
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
