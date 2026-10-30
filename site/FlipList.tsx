import React from 'react'
import NoteList from './NoteList'
import * as db from './Database'
import * as constants from './constants'
import { showToast } from './Toast'
import { useKeyboardShortcuts, useKeyboardScopes, shortcuts } from './KeyboardContext'
import {
  TopLevelStandardButtonContainer,
  TopLevelStandardButton,
} from './TopLevelStandardButton'

type Rating = 'fast' | 'med' | 'slow'

const RATING_BUTTONS: { rating: Rating; name: string; key: string }[] = [
  { rating: 'fast', name: 'Fast', key: '1' },
  { rating: 'med', name: 'Med', key: '2' },
  { rating: 'slow', name: 'Slow', key: '3' },
]

// Scopes active while a note is being edited; flip keys stay out of the
// way then, even when focus isn't in a field.
const EDIT_SCOPES = [
  constants.keyboardScopes.NOTE_EDIT,
  constants.keyboardScopes.NOTE_EDIT_IDEAS,
  constants.keyboardScopes.NOTE_EDIT_PILES,
  constants.keyboardScopes.NOTE_EDIT_LINKS,
]

const DAY = 24 * 60 * 60 * 1000

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DAY],
  ['month', 30 * DAY],
  ['week', 7 * DAY],
  ['day', DAY],
  ['hour', DAY / 24],
  ['minute', DAY / 24 / 60],
]

// Fuzzy relative time in the largest unit that fits: "just now",
// "3 hours ago", "yesterday", "2 weeks ago", "in 5 days".
function dateLabel(date: string, now: number) {
  const ms = new Date(date).getTime() - now
  for (const [unit, size] of UNITS) {
    if (Math.abs(ms) >= size) return relative.format(Math.round(ms / size), unit)
  }
  return 'just now'
}

// Where the card stands, shown above it: when it was created and last
// edited, last reviewed and due, and last seen before now. The deck
// carries the seen time from before it was dealt, so dealing it doesn't
// count.
function cardStatus(note: any) {
  const now = Date.now()
  const ago = (date: string) => dateLabel(date, now)
  const parts = []
  if (note.createdAt) parts.push(`Created ${ago(note.createdAt)}`)
  if (note.updatedAt) parts.push(`edited ${ago(note.updatedAt)}`)
  // Rated at least once; a reviewedAt alone may be left over from an edit.
  if (!note.reviewCount) {
    parts.push('never reviewed')
  } else {
    parts.push(`reviewed ${ago(note.reviewedAt)} (${note.reviewCount || 0}×)`)
    if (note.reviewDueAt) parts.push(`due ${ago(note.reviewDueAt)}`)
  }
  parts.push(
    note.seenAt
      ? `seen ${ago(note.seenAt)} (${note.seenCount || 0}×)`
      : 'never seen'
  )
  return parts.join(' · ')
}

// Flip: review notes one at a time, Anki-style. Each card is rated by
// how soon to see it again (fast / med / slow); the server schedules it
// and deals the next deck. Only a rating counts as a review; the server
// counts every note it loads, decks included, as seen. n and p step
// through the deck without rating. Each card starts selected, so Ctrl+E
// edits it right away.
function FlipList(props: any) {
  const [deck, setDeck] = React.useState<any[] | null>(null)
  const [index, setIndex] = React.useState(0)
  const [rating, setRating] = React.useState(false)
  const [ratedCount, setRatedCount] = React.useState(0)
  // Cards already shown in this deck. Going back to one fetches it again,
  // since it may have been edited or rated since the deck was dealt.
  const shown = React.useRef(new Set<string>())
  const activeScopes = useKeyboardScopes()
  const editing = EDIT_SCOPES.some((scope) => activeScopes.has(scope))

  React.useEffect(() => {
    props.setPageTitle('Flip')
  })

  const deal = React.useCallback(async () => {
    setDeck(null)
    setIndex(0)
    setRatedCount(0)
    shown.current = new Set()
    try {
      const response = await db.getRandomNotes()
      setDeck(response.data.data)
    } catch (error) {
      console.error(error)
      setDeck([])
    }
  }, [])

  React.useEffect(() => {
    deal()
  }, [deal])

  const current = deck?.[index]

  const rate = async (value: Rating) => {
    if (!current || rating) return
    setRating(true)
    try {
      await db.reviewNote(current._id, value)
      setRatedCount((n) => n + 1)
      setIndex((i) => i + 1)
    } catch (error) {
      console.error(error)
      showToast({ kind: 'error', message: 'Could not save the review' })
    } finally {
      setRating(false)
    }
  }

  const move = (step: number) => {
    if (!deck) return
    setIndex((i) => Math.min(deck.length, Math.max(0, i + step)))
  }

  const loadCurrent = async () => {
    const id = current._id
    if (!shown.current.has(id)) {
      shown.current.add(id)
      return { data: { data: [current] } }
    }
    return db.getInfo(db.types.note, id)
  }

  useKeyboardShortcuts(constants.keyboardScopes.FLIP, (event: any) => {
    if (editing) return false
    if (shortcuts.flip.next(event)) {
      move(1)
      return true
    }
    if (shortcuts.flip.prev(event)) {
      move(-1)
      return true
    }
    const value: Rating | null = shortcuts.flip.fast(event)
      ? 'fast'
      : shortcuts.flip.med(event)
      ? 'med'
      : shortcuts.flip.slow(event)
      ? 'slow'
      : null
    if (!value) return false
    rate(value)
    return true
  })

  if (!deck) return <div className="flip">Dealing…</div>

  if (!current) {
    return (
      <div className="flip">
        <p className="flip-status">
          {deck.length
            ? `Done: ${ratedCount} of ${deck.length} rated.`
            : 'No notes to review.'}
        </p>
        <TopLevelStandardButtonContainer>
          <TopLevelStandardButton name="Deal again" onClick={deal} />
        </TopLevelStandardButtonContainer>
      </div>
    )
  }

  return (
    <div className="flip">
      <div className="flip-header">
        <span className="flip-status">
          {index + 1} / {deck.length} · {cardStatus(current)}
        </span>
        <TopLevelStandardButtonContainer className="flip-ratings">
          <span className="flip-prompt">See again:</span>
          {RATING_BUTTONS.map((button, i) => (
            <TopLevelStandardButton
              key={button.rating}
              name={button.name}
              label={`See again ${button.name.toLowerCase()} (${button.key})`}
              position={i === 0 ? 'left' : i === RATING_BUTTONS.length - 1 ? 'right' : 'middle'}
              onClick={() => rate(button.rating)}
            />
          ))}
          <TopLevelStandardButton
            name="‹"
            label="Previous card (p)"
            position="left"
            onClick={() => move(-1)}
          />
          <TopLevelStandardButton
            name="›"
            label="Next card without rating (n)"
            position="right"
            onClick={() => move(1)}
          />
        </TopLevelStandardButtonContainer>
      </div>
      <NoteList
        key={current._id}
        viewMode={constants.view_modes.FULL}
        getListOfNotes={loadCurrent}
      />
    </div>
  )
}

export default FlipList
