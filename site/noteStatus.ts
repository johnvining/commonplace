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

// Where a note stands, shown above it on flip and on its own page: when
// it was created and last edited, last reviewed and due, and last opened
// on its own page.
export function noteStatus(note: any) {
  const now = Date.now()
  const ago = (date: string) => dateLabel(date, now)
  const parts = []
  if (note.createdAt) parts.push(`Created ${ago(note.createdAt)}`)
  if (note.updatedAt) parts.push(`edited ${ago(note.updatedAt)}`)
  // The server names the review state (#380); notes from an older server
  // fall back to its rule: rated at least once.
  const state = note.reviewState ?? (note.reviewCount ? 'scheduled' : 'unreviewed')
  if (state === 'unreviewed') {
    parts.push('never reviewed')
  } else {
    parts.push(`reviewed ${ago(note.reviewedAt)} (${note.reviewCount || 0}×)`)
    if (note.reviewDueAt) {
      const due = ago(note.reviewDueAt)
      parts.push(state === 'overdue' ? `overdue (due ${due})` : `due ${due}`)
    }
  }
  parts.push(
    note.lastOpenedAt
      ? `opened ${ago(note.lastOpenedAt)} (${note.openCount || 0}×)`
      : 'never opened'
  )
  return parts.join(' · ')
}
