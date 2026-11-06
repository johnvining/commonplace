import { useEffect, useRef, useState } from 'react'
import { hasOpenFields, isStandaloneApp } from './RefreshButton'

// How far to pull down, in px, before letting go reloads
export const PULL_THRESHOLD = 70

// Is the touch inside a field, or inside something already scrolled down
// (the image reader, a long field), where a downward drag scrolls it?
function pullBelongsElsewhere(target: EventTarget | null) {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return true
    if (el.scrollTop > 0) return true
  }
  return false
}

// Pull down from the top of the page to reload, in the installed app,
// which has no browser pull-to-refresh (#364).
export default function PullToRefresh({
  onRefresh = () => window.location.reload(),
  enabled = isStandaloneApp(),
}: {
  onRefresh?: () => void
  enabled?: boolean
}) {
  const [pull, setPull] = useState(0)
  // In a ref so re-rendering mid-pull doesn't re-register the listeners
  // and lose where the pull started
  const refresh = useRef(onRefresh)
  refresh.current = onRefresh

  useEffect(() => {
    if (!enabled) return
    let startY: number | null = null
    let distance = 0
    const start = (e: TouchEvent) => {
      // Off while editing, so a stray drag can't throw an edit away
      startY = e.touches.length === 1 && window.scrollY <= 0 && !pullBelongsElsewhere(e.target) && !hasOpenFields()
        ? e.touches[0].clientY
        : null
      distance = 0
    }
    const move = (e: TouchEvent) => {
      if (startY === null) return
      distance = Math.max(0, e.touches[0].clientY - startY)
      setPull(Math.min(distance, PULL_THRESHOLD * 1.5))
    }
    const end = () => {
      if (startY !== null && distance >= PULL_THRESHOLD) refresh.current()
      startY = null
      distance = 0
      setPull(0)
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
    }
  }, [enabled])

  if (!pull) return null
  return (
    <div className="pull-to-refresh" style={{ height: pull }} aria-live="polite">
      {pull >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
    </div>
  )
}
