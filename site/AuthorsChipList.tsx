import React, { useState, useEffect, useRef } from 'react'
import * as db from './Database'
import { AuthorLike } from './authorsDisplay'

// Ordered, editable list of authors as inline pills sharing a single
// styled input — same shape as Gmail "To:" or Linear's tag picker.
//
// - Each existing author renders as a pill with an × to remove.
// - Backspace at position 0 with an empty query removes the last pill.
// - Typing triggers a debounced suggestion fetch; Enter selects the
//   highlighted suggestion, or creates a new author if no match.
// - Order is significant (citation order). New authors append to the end.

interface Props {
  value: AuthorLike[]
  onChange: (next: AuthorLike[]) => void
  inputId?: string
  dontAutofocus?: boolean
}

export default function AuthorsChipList(props: Props) {
  const { value, onChange } = props
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<AuthorLike[]>([])
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
        const res: any = await db.getSuggestions('auth', query, false, controller.signal)
        const list: AuthorLike[] = res?.data?.data || []
        const taken = new Set(value.map((a) => a._id).filter(Boolean))
        const filtered = list.filter((a) => !taken.has(a._id))
        setSuggestions(filtered)
        setHighlighted(0)
        setOpen(true)
      } catch {
        // Aborted or network error — leave the existing list alone.
      }
    }, 180)
  }, [query, value])

  const append = (author: AuthorLike) => {
    if (!author?._id) return
    if (value.some((a) => a._id === author._id)) return
    onChange([...value, author])
    setQuery('')
    setSuggestions([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const removeAt = (index: number) => {
    const next = value.slice()
    next.splice(index, 1)
    onChange(next)
    inputRef.current?.focus()
  }

  const createAndAppend = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const res: any = await db.createRecord('auth', trimmed)
      const created: AuthorLike | undefined = res?.data?.data
      if (created?._id) append(created)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error(e)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // stopPropagation on the keys we handle so the app-wide keyboard
    // shortcut system doesn't ALSO fire (e.g. global Enter handlers).
    if (e.key === 'Backspace' && !query && value.length) {
      e.preventDefault()
      e.stopPropagation()
      onChange(value.slice(0, -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (suggestions.length && highlighted < suggestions.length) {
        append(suggestions[highlighted])
      } else if (query.trim()) {
        createAndAppend(query)
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
      setOpen(false)
      return
    }
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  // Close the suggestions dropdown when focus leaves the component.
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && containerRef.current?.contains(next)) return
    setOpen(false)
  }

  return (
    <div className="pill-input" ref={containerRef} onBlur={handleBlur}>
      <div className="pill-input-control" onClick={handleContainerClick}>
        {value.map((author, index) => (
          <span key={author._id ?? index} className="pill">
            <span className="pill-name">{author.name}</span>
            <button
              type="button"
              className="pill-remove"
              onClick={(e) => { e.stopPropagation(); removeAt(index) }}
              tabIndex={-1}
              aria-label={`Remove ${author.name ?? 'author'}`}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={props.inputId ?? 'add-author'}
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
                onMouseDown={(e) => { e.preventDefault(); append(s) }}
                onMouseEnter={() => setHighlighted(i)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
