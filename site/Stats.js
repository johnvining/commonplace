import React, { useState, useEffect } from 'react'
import * as db from './Database'

function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const response = await db.getStats()
        setStats(response.data.data)
        setError(null)
      } catch (err) {
        console.error('Error fetching stats:', err)
        setError('Failed to load statistics')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return <div className="stats-loading">...</div>
  }

  if (error) {
    return null // Don't show anything if there's an error
  }

  if (!stats) {
    return null
  }

  return (
    <div className="stats-display">
      <span className="stat-item">{stats.notes.toLocaleString()} notes</span>
      <span className="stat-item">
        {stats.authors.toLocaleString()} authors
      </span>
      <span className="stat-item">{stats.ideas.toLocaleString()} ideas</span>
      <span className="stat-item">{stats.works.toLocaleString()} works</span>
    </div>
  )
}

export default Stats
