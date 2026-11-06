import { TopLevelStandardButton } from './TopLevelStandardButton'

// Running from the home screen: no browser bar, so no reload button (#364)
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as any).standalone === true
  )
}

// Reloads the page. Shown only in the installed app, where the browser's
// own reload isn't there.
export default function RefreshButton({ onRefresh = () => window.location.reload() }: { onRefresh?: () => void }) {
  if (!isStandaloneApp()) return null
  return (
    <div className="tool-bar div">
      <TopLevelStandardButton label="Refresh" onClick={onRefresh}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M13 8a5 5 0 1 1-1.5-3.6" />
          <path d="M13 2.5v3h-3" />
        </svg>
      </TopLevelStandardButton>
    </div>
  )
}
