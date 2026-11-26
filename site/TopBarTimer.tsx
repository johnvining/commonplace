import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as db from './Database'

// The shared running timer, centered in the top bar: serif C, subject,
// and ticking elapsed. Polls the server timer (shared with iOS/Mac)
// every 5s; clicking goes to the Time page.
export default function TopBarTimer() {
  const [timer, setTimer] = useState<{ key: string; kind: string; label?: string; startedAt: number } | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    const fetchTimer = () => {
      db.getRunningTimer()
        .then((res: any) => {
          if (!alive) return
          const t = res.data?.data?.timer
          if (t && t.key && Number.isFinite(Date.parse(t.startedAt))) {
            setTimer({ key: t.key, kind: t.kind, label: t.label, startedAt: Date.parse(t.startedAt) })
          } else {
            setTimer(null)
          }
        })
        .catch(() => {})
    }
    fetchTimer()
    const poll = setInterval(fetchTimer, 5000)
    const onFocus = () => fetchTimer()
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      clearInterval(poll)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    if (!timer) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timer])

  if (!timer) return null

  const elapsedSec = Math.max(0, Math.floor((now - timer.startedAt) / 1000))
  const h = Math.floor(elapsedSec / 3600)
  const m = Math.floor((elapsedSec % 3600) / 60)
  const s = elapsedSec % 60
  const elapsed = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
  const label = timer.label || timer.key.replace(/^(pile|work|title):/, '')

  return (
    <Link to="/time" className="topbar-timer" title="Open the Time page">
      <span className="topbar-timer-kind">{timer.kind === 'reading' ? 'Reading' : 'Writing'}</span>
      <span className="topbar-timer-label">{label}</span>
      <span className="topbar-timer-elapsed">{elapsed}</span>
    </Link>
  )
}
