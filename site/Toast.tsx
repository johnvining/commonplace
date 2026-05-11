import React, { useEffect, useState } from 'react'

export type ToastKind = 'error' | 'success' | 'info'

export interface ToastDetail {
  kind: ToastKind
  message: string
  // Auto-dismiss after this many ms. Default 5000.
  ttl?: number
}

interface ToastItem extends ToastDetail {
  id: number
}

const EVENT = 'app:toast'
let nextId = 1

export function showToast(detail: ToastDetail) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(EVENT, { detail }))
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail
      const id = nextId++
      const ttl = detail.ttl ?? 5000
      setItems(prev => [...prev, { ...detail, id }])
      window.setTimeout(() => {
        setItems(prev => prev.filter(t => t.id !== id))
      }, ttl)
    }
    window.addEventListener(EVENT, onToast)
    return () => window.removeEventListener(EVENT, onToast)
  }, [])

  if (items.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '420px',
      }}
    >
      {items.map(t => (
        <div
          key={t.id}
          onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            background:
              t.kind === 'error'
                ? '#c44'
                : t.kind === 'success'
                ? '#363'
                : '#446',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
