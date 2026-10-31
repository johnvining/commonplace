// Day/night theme: 'auto' follows the system; 'light' and 'dark' force it
// by setting data-theme on <html> (see _minimal.scss). Remembered per
// browser.
export type Theme = 'auto' | 'light' | 'dark'

const KEY = 'theme'

export const NEXT_THEME: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' }

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyTheme(theme: Theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Private mode etc.: the choice just won't stick.
  }
  applyTheme(theme)
}
