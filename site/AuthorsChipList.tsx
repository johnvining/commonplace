import React from 'react'
import Autocomplete from './Autocomplete'
import * as db from './Database'
import { AuthorLike } from './authorsDisplay'

// Ordered, editable list of authors for Note and Work editors.
//
// Each existing author renders as a chip with ↑ / ↓ reorder buttons and an
// × remove. A trailing autocomplete adds a new author — selecting an
// existing one appends it to the list, and typing a brand-new name creates
// an Auth record then appends. Order is significant (citation order).

interface Props {
  value: AuthorLike[]
  onChange: (next: AuthorLike[]) => void
  inputId?: string
  dontAutofocus?: boolean
}

export default function AuthorsChipList(props: Props) {
  const { value, onChange } = props

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return
    const next = value.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const remove = (index: number) => {
    const next = value.slice()
    next.splice(index, 1)
    onChange(next)
  }

  const append = (author: AuthorLike) => {
    if (!author?._id) return
    if (value.some((a) => a._id === author._id)) return
    onChange([...value, author])
  }

  // Existing Autocomplete fires onSelect(id, name) when picking a suggestion.
  const handleSelectExisting = (authorId: string, authorName: string) => {
    append({ _id: authorId, name: authorName })
  }

  // handleNewSelect fires when the user submits a name that didn't match.
  // We create the Auth record then append.
  const handleCreateNew = async (authorName: string) => {
    if (!authorName) return
    const response: any = await db.createRecord(db.types.auth, authorName)
    const created = response?.data
    if (created?._id) {
      append({ _id: created._id, name: created.name ?? authorName })
    }
  }

  return (
    <div className="authors-chip-list">
      {value.length > 0 && (
        <div className="authors-chip-list-chips">
          {value.map((author, index) => (
            <span key={author._id ?? index} className="authors-chip">
              <span className="authors-chip-name">{author.name}</span>
              {value.length > 1 && (
                <>
                  <button
                    type="button"
                    className="authors-chip-move"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    title="Move up"
                    aria-label="Move up"
                  >↑</button>
                  <button
                    type="button"
                    className="authors-chip-move"
                    onClick={() => move(index, index + 1)}
                    disabled={index === value.length - 1}
                    title="Move down"
                    aria-label="Move down"
                  >↓</button>
                </>
              )}
              <button
                type="button"
                className="authors-chip-remove"
                onClick={() => remove(index)}
                title="Remove author"
                aria-label="Remove author"
              >×</button>
            </span>
          ))}
        </div>
      )}
      <Autocomplete
        inputName={props.inputId ?? 'add-author'}
        className="top-level author-select"
        dontAutofocus={props.dontAutofocus}
        defaultValue=""
        onSelect={handleSelectExisting}
        getSuggestions={db.getSuggestions}
        apiType={db.types.auth}
        handleNewSelect={handleCreateNew}
        onClearText={() => {}}
      />
    </div>
  )
}
