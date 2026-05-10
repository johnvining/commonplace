import { useEffect, useState } from 'react'
import { isPinned, togglePinned } from './pinned'
import { TopLevelStandardButton } from './TopLevelStandardButton'
import star from 'url:./icons/star.svg'
import starFilled from 'url:./icons/star-filled.svg'

function PinButton({
  type,
  id,
  label,
  href,
  className = '',
  compact = false,
  showLabel,
  stopPropagation = true,
  tabIndex,
}) {
  const [pinned, setPinned] = useState(isPinned(type, id))
  const shouldShowLabel = showLabel ?? !compact
  const iconOnly = compact && !shouldShowLabel

  useEffect(() => {
    const handleUpdate = () => setPinned(isPinned(type, id))
    window.addEventListener('pinned-items-updated', handleUpdate)
    return () => window.removeEventListener('pinned-items-updated', handleUpdate)
  }, [type, id])

  const handleClick = (event) => {
    if (stopPropagation && event) {
      event.preventDefault()
      event.stopPropagation()
    }
    togglePinned({ type, id, label, href })
    setPinned(isPinned(type, id))
  }

  return (
    <button
      className={[
        'button',
        'pin-button',
        pinned ? 'starred' : 'unstarred',
        compact ? 'pin-button-compact' : '',
        iconOnly ? 'pin-button-icon-only' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      aria-pressed={pinned}
      aria-label={pinned ? 'Starred' : 'Star'}
      title={pinned ? 'Starred' : 'Star'}
      tabIndex={tabIndex}
    >
      <img
        className="pin-button-icon"
        src={pinned ? starFilled : star}
        alt=""
        aria-hidden="true"
      />
      {shouldShowLabel ? (
        <span className="pin-button-label">{pinned ? 'Starred' : 'Star'}</span>
      ) : null}
    </button>
  )
}

export default PinButton

export function TopLevelStarButton({ type, id, label, href }) {
  const [pinned, setPinned] = useState(isPinned(type, id))

  useEffect(() => {
    const handleUpdate = () => setPinned(isPinned(type, id))
    window.addEventListener('pinned-items-updated', handleUpdate)
    return () => window.removeEventListener('pinned-items-updated', handleUpdate)
  }, [type, id])

  const handleClick = (event) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    togglePinned({ type, id, label, href })
    setPinned(isPinned(type, id))
  }

  return (
    <TopLevelStandardButton
      position="left-right"
      onClick={handleClick}
      className="has-icon"
    >
      <img
        className="pin-button-icon"
        src={pinned ? starFilled : star}
        alt=""
        aria-hidden="true"
      />
      <span>{pinned ? 'Starred' : 'Star'}</span>
    </TopLevelStandardButton>
  )
}
