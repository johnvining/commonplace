import React, { useState, useEffect, useRef } from 'react'
import { bulkEmbedNotes, bulkEmbedNotesStatus, backfillNicks, backfillNicksStatus } from './Database'

function JobPanel({ title, description, onRun, onStatus }) {
  const [state, setState] = useState({ status: 'idle', results: null, error: null, startedAt: null, finishedAt: null })
  const pollRef = useRef(null)

  const startPolling = () => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await onStatus()
        const s = res.data.data
        setState(s)
        if (s.status === 'done' || s.status === 'error') {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      } catch {}
    }, 2000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const handleRun = async () => {
    try {
      const res = await onRun()
      setState(res.data.data)
      startPolling()
    } catch (e) {
      setState(s => ({ ...s, status: 'error', error: e.message }))
    }
  }

  const statusColor = { idle: '#888', running: '#c8a84b', done: '#4caf50', error: '#e57373' }[state.status] || '#888'

  return (
    <div style={{ border: '1px solid #333', borderRadius: 6, padding: '20px 24px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{description}</div>
        </div>
        <button
          className="button"
          onClick={handleRun}
          disabled={state.status === 'running'}
          style={{ minWidth: 80 }}
        >
          {state.status === 'running' ? 'Running...' : 'Run'}
        </button>
      </div>

      {state.status !== 'idle' && (
        <div style={{ marginTop: 12, fontSize: 12, fontFamily: 'monospace' }}>
          <span style={{ color: statusColor, marginRight: 8 }}>●</span>
          <span style={{ color: statusColor }}>{state.status.toUpperCase()}</span>
          {state.startedAt && (
            <span style={{ color: '#666', marginLeft: 12 }}>
              started {new Date(state.startedAt).toLocaleTimeString()}
            </span>
          )}
          {state.finishedAt && (
            <span style={{ color: '#666', marginLeft: 8 }}>
              · finished {new Date(state.finishedAt).toLocaleTimeString()}
            </span>
          )}
          {state.error && (
            <div style={{ color: '#e57373', marginTop: 6 }}>{state.error}</div>
          )}
          {state.results && (
            <pre style={{ marginTop: 8, padding: '8px 12px', background: '#1a1a1a', borderRadius: 4, whiteSpace: 'pre-wrap', color: '#ccc' }}>
              {JSON.stringify(state.results, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function Admin({ setPageTitle }) {
  useEffect(() => { setPageTitle('Admin') }, [])

  return (
    <div style={{ maxWidth: 640, padding: '32px 24px' }}>
      <h2 style={{ marginBottom: 24, fontSize: 18, fontWeight: 600 }}>Admin</h2>

      <JobPanel
        title="Backfill Nicks"
        description="Generate short nicknames for any notes, works, ideas, or piles that don't have one."
        onRun={backfillNicks}
        onStatus={backfillNicksStatus}
      />

      <JobPanel
        title="Backfill Embeddings"
        description="Generate or refresh semantic embeddings for all notes."
        onRun={bulkEmbedNotes}
        onStatus={bulkEmbedNotesStatus}
      />
    </div>
  )
}

export default Admin
