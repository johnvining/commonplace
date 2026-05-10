import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as db from './Database'

const CACHE_KEY = 'stats_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

function Stats() {
  const [stats, setStats] = useState(() => readCache())
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // If we already have cached data, fetch in the background to refresh it
    const fetchStats = async () => {
      try {
        const response = await db.getStats()
        setStats(response.data.data)
        setError(null)
        writeCache(response.data.data)
      } catch (err) {
        console.error('Error fetching stats:', err)
        if (!stats) setError('Failed to load statistics')
      }
    }

    fetchStats()
  }, [])

  const handleStatClick = (type) => {
    navigate(`/recent/${type}`)
  }

  if (error && !stats) {
    return null
  }

  if (!stats) {
    return <div className="stats-loading">...</div>
  }

  return (
    <div className="stats-display">
      <span 
        className="stat-item" 
        onClick={() => handleStatClick('notes')}
        style={{ cursor: 'pointer' }}
      >
        {stats.notes.toLocaleString()} notes
      </span>
      <span 
        className="stat-item"
        onClick={() => handleStatClick('authors')}
        style={{ cursor: 'pointer' }}
      >
        {stats.authors.toLocaleString()} authors
      </span>
      <span 
        className="stat-item"
        onClick={() => handleStatClick('ideas')}
        style={{ cursor: 'pointer' }}
      >
        {stats.ideas.toLocaleString()} ideas
      </span>
      <span 
        className="stat-item"
        onClick={() => handleStatClick('works')}
        style={{ cursor: 'pointer' }}
      >
        {stats.works.toLocaleString()} works
      </span>
      <span 
        className="stat-item"
        onClick={() => handleStatClick('piles')}
        style={{ cursor: 'pointer' }}
      >
        {stats.piles.toLocaleString()} piles
      </span>
    </div>
  )
}

export default Stats
