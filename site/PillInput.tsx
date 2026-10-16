import React, { useState, useEffect, useRef } from 'react'
import * as db from './Database'
import { yearsLabel, NO_AUTOFILL } from './utils'

// The shared pill-input multi-select behind AuthorsChipList,
// IdeasPillList and PilesPillList: chips for the current items, one
// inline input, and a dropdown of matches.
//
// - Typing fetches matches (debounced), minus items already chosen.
// - Enter adds the highlighted match, or creates the typed name.
// - Backspace in an empty input removes the last chip; × removes one.
// - Escape closes the dropdown, then calls onExit.
// Keys it handles are stopped here so the app-wide shortcuts don't also
// fire.

export interface PillItem {
  _id?: string
  name?: string | null
}

// Extra dropdown entries after the search matches (e.g. AI suggestions),
// shown with a small tag. Entries without an _id are created on pick.
export interface ExtraSuggestion {
  item: PillItem
  tag: string
}

interface Props {
  type: string
  value: PillItem[]
  onAdd: (item: PillItem) => void
  onCreate: (name: string) => void
  onRemove: (index: number, item: PillItem) => void
  onExit?: () => void
  inputId: string
  dontAutofocus?: boolean
  // Extra classes on the wrapper and on each chip, for per-type colors.
  className?: string
  pillClassName?: string
  // How a name shows in chips and the dropdown (default: as is).
  renderName?: (item: PillItem) => React.ReactNode
  showYears?: boolean
  extraSuggestions?: ExtraSuggestion[]
  // Buttons inside the control, after the input.
  controls?: React.ReactNode
}

interface Entry {
  item: PillItem
  tag?: string
}

export default function PillInput(props: Props) {
  const { value, extraSuggestions = [] } = props
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<PillItem[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const name = props.renderName ?? ((item: PillItem) => item.name)

  const entries: Entry[] = [
    ...matches.map((item) => ({ item })),
    ...extraSuggestions.map(({ item, tag }) => ({ item, tag })),
  ]

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (requestRef.current) requestRef.current.abort()
    }
  }, [])

  // Show extra suggestions as soon as the parent supplies them.
  useEffect(() => {
    if (extraSuggestions.length) {
      setOpen(true)
      setHighlighted(0)
    }
  }, [extraSuggestions])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (requestRef.current) requestRef.current.abort()
    if (!query.trim()) {
      setMatches([])
      if (!extraSuggestions.length) setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      requestRef.current = controller
      try {
        const res: any = await db.getSuggestions(props.type, query, false, controller.signal)
        const list: PillItem[] = res?.data?.data || []
        const taken = new Set(value.map((i) => i._id).filter(Boolean))
        setMatches(list.filter((i) => !taken.has(i._id)))
        setHighlighted(0)
        setOpen(true)
      } catch {
        // Aborted or network error: leave the current list alone.
      }
    }, 180)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, value])

  const clearAfterAdd = () => {
    setQuery('')
    setMatches([])
    setOpen(false)
    setHighlighted(0)
    inputRef.current?.focus()
  }

  const pick = (entry: Entry) => {
    if (entry.item._id) props.onAdd(entry.item)
    else if (entry.item.name) props.onCreate(entry.item.name)
    clearAfterAdd()
  }

  const create = (typed: string) => {
    const trimmed = typed.trim()
    if (!trimmed) return
    props.onCreate(trimmed)
    clearAfterAdd()
  }

  const remove = (index: number) => {
    props.onRemove(index, value[index])
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !query && value.length) {
      e.preventDefault()
      e.stopPropagation()
      remove(value.length - 1)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (entries.length && highlighted < entries.length) pick(entries[highlighted])
      else create(query)
      return
    }
    if (e.key === 'ArrowDown') {
      if (entries.length) {
        e.preventDefault()
        e.stopPropagation()
        setHighlighted((h) => Math.min(h + 1, entries.length - 1))
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowUp') {
      if (entries.length) {
        e.preventDefault()
        e.stopPropagation()
        setHighlighted((h) => Math.max(h - 1, 0))
      }
      return
    }
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (open) setOpen(false)
      else if (props.onExit) props.onExit()
    }
  }

  // Close the dropdown when focus leaves the component.
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && containerRef.current?.contains(next)) return
    setOpen(false)
  }

  return (
    <div
      className={'pill-input' + (props.className ? ' ' + props.className : '')}
      ref={containerRef}
      onBlur={handleBlur}
    >
      <div className="pill-input-control" onClick={() => inputRef.current?.focus()}>
        {value.map((item, index) => (
          <span key={item._id ?? index} className={'pill' + (props.pillClassName ? ' ' + props.pillClassName : '')}>
            <span className="pill-name">{name(item)}</span>
            <button
              type="button"
              className="pill-remove"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); remove(index) }}
              aria-label={`Remove ${item.name ?? ''}`}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={props.inputId}
          className="pill-input-field"
          autoFocus={!props.dontAutofocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (entries.length) setOpen(true) }}
          {...NO_AUTOFILL}
        />
        {props.controls}
      </div>
      {open && entries.length > 0 && (
        <ul className="pill-input-suggestions">
          {entries.map((entry, i) => (
            <li key={(entry.tag ?? 's') + '-' + (entry.item._id ?? entry.item.name ?? i)}>
              <button
                type="button"
                tabIndex={-1}
                className={'pill-input-option' + (i === highlighted ? ' highlighted' : '')}
                onMouseDown={(e) => { e.preventDefault(); pick(entry) }}
                onMouseEnter={() => setHighlighted(i)}
              >
                {name(entry.item)}
                {props.showYears && yearsLabel(entry.item) && (
                  <span className="pill-input-years">{yearsLabel(entry.item)}</span>
                )}
                {entry.tag && <span className="pill-input-ai-tag">{entry.tag}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
