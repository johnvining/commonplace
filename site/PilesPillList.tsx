import React, { useState, useEffect, useRef } from 'react'
import * as db from './Database'

// Pill-input multi-select for piles on a note. Same shape as
// IdeasPillList but no AI suggestions, and each pill renders the
// existing "Prefix: Name" convention with the prefix as a small tag.

interface PileLike {
  _id?: string
  name?: string | null
}

interface Props {
  value: PileLike[]
  onAddExisting: (pile: PileLike) => void
  onCreateNew: (name: string) => void
  onRemove: (pileId: string) => void
  // Esc with an empty input + closed dropdown — typically exits the parent's
  // "edit piles" mode.
  onExit?: () => void
  inputId?: string
  dontAutofocus?: boolean
  compact?: boolean
}

// Split a `Prefix: Name` pile name into `{ pre, label }`. If there is no
// colon, returns the whole name as the label.
function splitPileName(name: string | null | undefined): { pre: string | null; label: string } {
  if (!name) return { pre: null, label: '' }
  const idx = name.indexOf(':')
  if (idx < 0) return { pre: null, label: name }
  return { pre: name.slice(0, idx).trim(), label: name.slice(idx + 1).trim() }
}

function PileLabel({ name }: { name?: string | null }) {
  const { pre, label } = splitPileName(name)
  return (
    <>
      {pre ? <span className="pill-pre">{pre}</span> : null}
      <span>{label}</span>
    </>
  )
}

export default function PilesPillList(props: Props) {
  const { value, onAddExisting, onCreateNew, onRemove } = props
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PileLike[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (requestRef.current) requestRef.current.abort()
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (requestRef.current) requestRef.current.abort()
    if (!query.trim()) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      requestRef.current = controller
      try {
        const res: any = await db.getSuggestions('pile', query, false, controller.signal)
        const list: PileLike[] = res?.data?.data || []
        const taken = new Set(value.map((p) => p._id).filter(Boolean))
        setSuggestions(list.filter((p) => !taken.has(p._id)))
        setHighlighted(0)
        setOpen(true)
      } catch {
        // ignored
      }
    }, 180)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, value])

  const clearAfterAdd = () => {
    setQuery('')
    setSuggestions([])
    setOpen(false)
    setHighlighted(0)
    inputRef.current?.focus()
  }

  const addExisting = (pile: PileLike) => {
    if (!pile._id) return
    onAddExisting(pile)
    clearAfterAdd()
  }

  const createNew = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreateNew(trimmed)
    clearAfterAdd()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && value.length) {
      e.preventDefault()
      e.stopPropagation()
      const last = value[value.length - 1]
      if (last._id) onRemove(last._id)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (suggestions.length && highlighted < suggestions.length) {
        addExisting(suggestions[highlighted])
      } else if (query.trim()) {
        createNew(query)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      if (suggestions.length) {
        e.preventDefault()
        e.stopPropagation()
        setHighlighted((h) => Math.min(h + 1, suggestions.length - 1))
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowUp') {
      if (suggestions.length) {
        e.preventDefault()
        e.stopPropagation()
        setHighlighted((h) => Math.max(h - 1, 0))
      }
      return
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (open) {
        setOpen(false)
      } else if (props.onExit) {
        props.onExit()
      }
      return
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && containerRef.current?.contains(next)) return
    setOpen(false)
  }

  return (
    <div className={'pill-input piles' + (props.compact ? ' compact' : '')} ref={containerRef} onBlur={handleBlur}>
      <div className="pill-input-control" onClick={() => inputRef.current?.focus()}>
        {value.map((pile, index) => (
          <span key={pile._id ?? index} className="pill pill-pile">
            <span className="pill-name">
              <PileLabel name={pile.name} />
            </span>
            <button
              type="button"
              className="pill-remove"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); if (pile._id) onRemove(pile._id) }}
              aria-label={`Remove ${pile.name ?? 'pile'}`}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={props.inputId ?? 'add-pile'}
          className="pill-input-field"
          autoFocus={!props.dontAutofocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length) setOpen(true) }}
          autoComplete="off"
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="pill-input-suggestions">
          {suggestions.map((s, i) => (
            <li key={s._id ?? i}>
              <button
                type="button"
                tabIndex={-1}
                className={'pill-input-option' + (i === highlighted ? ' highlighted' : '')}
                onMouseDown={(e) => { e.preventDefault(); addExisting(s) }}
                onMouseEnter={() => setHighlighted(i)}
              >
                <PileLabel name={s.name} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
