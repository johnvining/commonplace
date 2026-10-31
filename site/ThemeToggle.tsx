import { useState } from 'react'
import { TopLevelStandardButton } from './TopLevelStandardButton'
import { useKeyboardShortcuts, shortcuts } from './KeyboardContext'
import * as constants from './constants'
import { NEXT_THEME, getTheme, setTheme, type Theme } from './theme'

const LABELS: Record<Theme, string> = {
  auto: 'Theme: follow system',
  light: 'Theme: day',
  dark: 'Theme: night',
}

// Drawn with currentColor, so they follow the theme without filters.
function ThemeIcon({ theme }: { theme: Theme }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }
  if (theme === 'light') {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
    )
  }
  if (theme === 'dark') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" />
      </svg>
    )
  }
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor" />
    </svg>
  )
}

// Cycles follow-system → day → night.
export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const cycle = () => {
    const next = NEXT_THEME[theme]
    setTheme(next)
    setThemeState(next)
  }
  useKeyboardShortcuts(constants.keyboardScopes.GLOBAL, (event: any) => {
    if (!shortcuts.global.theme(event)) return false
    cycle()
    return true
  })
  return (
    <TopLevelStandardButton label={LABELS[theme]} shortcut="d" onClick={cycle}>
      <ThemeIcon theme={theme} />
    </TopLevelStandardButton>
  )
}
