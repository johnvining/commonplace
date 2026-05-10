import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as db from './Database'
import { getPinnedItems, unpinItem } from './pinned'
import starSmall from 'url:./icons/star-small.svg'

const RECENT_LIMIT = 15
const SIDEBAR_CACHE_KEY = 'sidebar_cache'
const SIDEBAR_CACHE_TTL = 5 * 60 * 1000

function readSidebarCache() {
  try {
    const raw = localStorage.getItem(SIDEBAR_CACHE_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > SIDEBAR_CACHE_TTL) return null
    return data
  } catch { return null }
}

function writeSidebarCache(data) {
  try {
    localStorage.setItem(SIDEBAR_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

function Sidebar() {
  const cached = readSidebarCache()
  const [recentIdeas, setRecentIdeas] = useState<any[]>(cached?.ideas || [])
  const [recentPiles, setRecentPiles] = useState<any[]>(cached?.piles || [])
  const [pinnedItems, setPinnedItems] = useState<import('./pinned').PinnedItem[]>([])
  const [loading, setLoading] = useState(!cached)
  useEffect(() => {
    let isMounted = true

    const loadRecent = async () => {
      try {
        const [ideasResponse, pilesResponse] = await Promise.all([
          db.getRecentItems('ideas'),
          db.getRecentItems('piles'),
        ])

        if (!isMounted) return

        const ideas = (ideasResponse.data.data || []).slice(0, RECENT_LIMIT)
        const piles = (pilesResponse.data.data || []).slice(0, RECENT_LIMIT)
        setRecentIdeas(ideas)
        setRecentPiles(piles)
        writeSidebarCache({ ideas, piles })
      } catch (error) {
        console.error('Sidebar recent load error:', error)
        if (isMounted && !cached) {
          setRecentIdeas([])
          setRecentPiles([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadRecent()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const refreshPinned = () => setPinnedItems(getPinnedItems())
    refreshPinned()
    window.addEventListener('pinned-items-updated', refreshPinned)
    return () => window.removeEventListener('pinned-items-updated', refreshPinned)
  }, [])

  const typeLabels = {
    note: 'Note',
    work: 'Work',
    idea: 'Idea',
    pile: 'Pile',
    auth: 'Author',
  }

  const getPileItemCount = (pile) => {
    const noteCount = pile?.note_count ?? 0
    const workCount = pile?.work_count ?? 0
    return noteCount + workCount
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-title">Starred Items</div>
        {pinnedItems.length ? (
          <div className="sidebar-list sidebar-list-compact">
            {pinnedItems.map((item) => (
              <div className="sidebar-pin-row" key={`${item.type}-${item.id}`}>
                <Link
                  to={item.href}
                  className="sidebar-link sidebar-link-compact"
                >
                  <span className="sidebar-item">
                    {item.label || 'Untitled'}
                  </span>
                  <span className="sidebar-count">
                    {typeLabels[item.type] || 'Item'}
                  </span>
                </Link>
                <button
                  className="button pin-button pin-button-compact pin-button-inline pin-button-icon-only starred"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    unpinItem(item.type, item.id)
                  }}
                >
                  <img
                    className="pin-button-icon pin-button-icon-small"
                    src={starSmall}
                    alt=""
                    aria-hidden="true"
                  />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="sidebar-muted">No pinned items</div>
        )}
      </div>
      <div className="sidebar-section">
        <div className="sidebar-title">Recent Ideas</div>
        {loading ? (
          <div className="sidebar-muted">Loading...</div>
        ) : (
          <div className="sidebar-list sidebar-list-compact">
            {recentIdeas.length ? (
              recentIdeas.map((idea) => (
                <Link
                  key={idea._id}
                  to={`/idea/${idea._id}`}
                  className="sidebar-link sidebar-link-compact"
                >
                  <span className="sidebar-item">{idea.name}</span>
                  <span className="sidebar-count">
                    {idea.note_count?.toLocaleString() ?? 0}
                  </span>
                </Link>
              ))
            ) : (
              <div className="sidebar-muted">No recent ideas</div>
            )}
          </div>
        )}
      </div>
      <div className="sidebar-section">
        <div className="sidebar-title">Recent Piles</div>
        {loading ? (
          <div className="sidebar-muted">Loading...</div>
        ) : (
          <div className="sidebar-list sidebar-list-compact">
            {recentPiles.length ? (
              recentPiles.map((pile) => (
                <Link
                  key={pile._id}
                  to={`/pile/${pile._id}`}
                  className="sidebar-link sidebar-link-compact"
                >
                  <span className="sidebar-item">{pile.name}</span>
                  <span className="sidebar-count">
                    {getPileItemCount(pile).toLocaleString()}
                  </span>
                </Link>
              ))
            ) : (
              <div className="sidebar-muted">No recent piles</div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
