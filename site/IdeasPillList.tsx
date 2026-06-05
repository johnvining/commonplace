import React, { useState, useEffect, useRef } from 'react'
import * as db from './Database'
import lightbulb from 'url:./icons/lightbulb.svg'

// Pill-input multi-select for ideas on a note. Same shape as
// AuthorsChipList, but each add/remove fires its own callback so the
// parent can persist immediately (notes save idea changes per-action,
// not at "Done" time like authors).
//
// Ideas have a dedicated color in the existing palette ($semantic_idea);
// the pills use that styling via a modifier class on the wrapper.

interface IdeaLike {
  _id?: string
  name?: string | null
}

interface Props {
  value: IdeaLike[]
  onAddExisting: (idea: IdeaLike) => void
  onCreateNew: (name: string) => void
  onRemove: (ideaId: string) => void
  fetchAiSuggestions?: () => Promise<IdeaLike[]>
  // Esc with an empty input + closed dropdown calls this — typically used
  // to exit the wider "edit ideas" mode the parent is in.
  onExit?: () => void
  inputId?: string
  dontAutofocus?: boolean
}

interface DropdownItem {
  source: 'search' | 'ai'
  item: IdeaLike
}

export default function IdeasPillList(props: Props) {
  const { value, onAddExisting, onCreateNew, onRemove } = props
  const [query, setQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<IdeaLike[]>([])
  const [aiSuggestions, setAiSuggestions] = useState<IdeaLike[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef<AbortController | null>(null)

  // Combined dropdown list — search hits first, then AI suggestions.
  // Both already exclude items already on the note.
  const items: DropdownItem[] = [
    ...searchSuggestions.map((item) => ({ source: 'search' as const, item })),
    ...aiSuggestions.map((item) => ({ source: 'ai' as const, item })),
  ]

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
      setSearchSuggestions([])
      if (!aiSuggestions.length) setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      requestRef.current = controller
      try {
        const res: any = await db.getSuggestions('idea', query, false, controller.signal)
        const list: IdeaLike[] = res?.data?.data || []
        const taken = new Set(value.map((i) => i._id).filter(Boolean))
        setSearchSuggestions(list.filter((i) => !taken.has(i._id)))
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
    setSearchSuggestions([])
    setAiSuggestions([])
    setOpen(false)
    setHighlighted(0)
    inputRef.current?.focus()
  }

  const addItem = (item: DropdownItem) => {
    if (item.source === 'search' && item.item._id) {
      onAddExisting(item.item)
    } else if (item.item.name) {
      // AI suggestions don't carry an _id — always create.
      onCreateNew(item.item.name)
    }
    clearAfterAdd()
  }

  const handleFetchAi = async () => {
    if (!props.fetchAiSuggestions) return
    setAiLoading(true)
    try {
      const list = await props.fetchAiSuggestions()
      const takenNames = new Set(value.map((i) => i.name).filter(Boolean))
      setAiSuggestions(list.filter((i) => i.name && !takenNames.has(i.name)))
      setOpen(true)
      setHighlighted(0)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error(e)
    } finally {
      setAiLoading(false)
    }
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
      if (items.length && highlighted < items.length) {
        addItem(items[highlighted])
      } else if (query.trim()) {
        onCreateNew(query.trim())
        clearAfterAdd()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      if (items.length) {
        e.preventDefault()
        e.stopPropagation()
        setHighlighted((h) => Math.min(h + 1, items.length - 1))
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowUp') {
      if (items.length) {
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
    <div
      className="pill-input ideas"
      ref={containerRef}
      onBlur={handleBlur}
    >
      <div className="pill-input-control" onClick={() => inputRef.current?.focus()}>
        {value.map((idea, index) => (
          <span key={idea._id ?? index} className="pill pill-idea">
            <span className="pill-name">{idea.name}</span>
            <button
              type="button"
              className="pill-remove"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); if (idea._id) onRemove(idea._id) }}
              aria-label={`Remove ${idea.name ?? 'idea'}`}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={props.inputId ?? 'add-idea'}
          className="pill-input-field"
          autoFocus={!props.dontAutofocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (items.length) setOpen(true) }}
          autoComplete="off"
        />
        {props.fetchAiSuggestions && (
          <button
            type="button"
            className="pill-input-ai"
            onClick={handleFetchAi}
            disabled={aiLoading}
            tabIndex={-1}
            title="Suggest ideas"
            aria-label="Suggest ideas with AI"
          >
            <img src={lightbulb} alt="" />
          </button>
        )}
      </div>
      {open && items.length > 0 && (
        <ul className="pill-input-suggestions">
          {items.map((entry, i) => (
            <li key={(entry.source === 'search' ? 's-' : 'ai-') + (entry.item._id ?? entry.item.name ?? i)}>
              <button
                type="button"
                tabIndex={-1}
                className={'pill-input-option' + (i === highlighted ? ' highlighted' : '')}
                onMouseDown={(e) => { e.preventDefault(); addItem(entry) }}
                onMouseEnter={() => setHighlighted(i)}
              >
                {entry.item.name}
                {entry.source === 'ai' && <span className="pill-input-ai-tag">AI</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
