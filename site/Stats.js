import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as db from './Database'

function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

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

  const handleStatClick = (type) => {
    navigate(`/recent/${type}`)
  }

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
