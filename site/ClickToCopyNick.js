import React, { useState } from 'react'
import clipboard from 'url:./icons/clipboard.svg'
import clipboard_check from 'url:./icons/clipboard_check.svg'

function ClickToCopyNick({
  nick,
  className = '',
  style = {},
  disableClick = false,
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (disableClick) return

    try {
      await navigator.clipboard.writeText(nick)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy nick:', err)
    }
  }

  if (!nick) return null

  return (
    <div
      className={`click-to-copy-nick ${
        disableClick ? 'disabled' : ''
      } ${className}`}
      style={{
        display: 'inline',
        cursor: disableClick ? 'default' : 'pointer',
        ...style,
      }}
      onClick={handleCopy}
      title={disableClick ? undefined : 'Click to copy nick'}
    >
      {!disableClick && (
        <img
          src={copied ? clipboard_check : clipboard}
          alt={copied ? 'Copied!' : 'Copy'}
          style={{
            marginRight: '5px',
            width: '14px',
            height: '14px',
            verticalAlign: 'middle',
            opacity: disableClick ? 0.3 : 0.7,
          }}
        />
      )}

      <code style={{ color: 'grey' }}>
        <small>{nick}</small>
      </code>
    </div>
  )
}

export default ClickToCopyNick
