// Spaced review for /flip: a small Anki-style scheduler.
//
// Each note carries
// - reviewedAt: when it was last rated,
// - reviewDueAt: the next review target,
// - reviewInterval: days between reviewedAt and reviewDueAt,
// - reviewCount: how many times it has been rated,
// - lastOpenedAt: when its own page was last opened (with openCount; see
//   recordOpened), which the deck uses to lean toward notes not looked at
//   lately.
// Only a rating moves the review fields: editing a note (updatedAt) or
// opening it doesn't. A note is reviewed once reviewCount > 0. Don't go by
// reviewedAt alone: an earlier version set it on edits too, so older
// notes can have one without ever being rated.

export const REVIEWED = { reviewCount: { $gt: 0 } }
export const NEVER_REVIEWED = { reviewCount: { $not: { $gt: 0 } } }

const DAY = 24 * 60 * 60 * 1000

export const RATINGS = ['fast', 'med', 'slow'] as const
export type Rating = (typeof RATINGS)[number]

// Each rating sends the card back at a random point in a fixed window
// (in days), so cards rated together don't come back together.
// fast: within a week; med: within six months; slow: within 18 months.
export const WINDOWS: Record<Rating, [number, number]> = {
  fast: [1, 7],
  med: [30, 182],
  slow: [182, 548],
}

export interface ReviewState {
  reviewedAt?: Date | null
  reviewDueAt?: Date | null
  reviewInterval?: number | null
  reviewCount?: number | null
  lastOpenedAt?: Date | null
}

export interface ReviewUpdate {
  reviewedAt: Date
  reviewDueAt: Date
  reviewInterval: number
  reviewCount: number
}

export function scheduleReview(
  state: ReviewState,
  rating: Rating,
  now = new Date(),
  rand: () => number = Math.random
): ReviewUpdate {
  const [min, max] = WINDOWS[rating]
  const next = Math.round((min + rand() * (max - min)) * 100) / 100
  return {
    reviewedAt: now,
    reviewDueAt: new Date(now.getTime() + next * DAY),
    reviewInterval: next,
    reviewCount: (state.reviewCount || 0) + 1,
  }
}

// How much a reviewed card wants to be seen: the fraction of its interval
// that has passed. 1 is exactly due, 2 is overdue by a whole interval.
// Never-reviewed cards don't have a priority; they're drawn separately.
export function reviewPriority(state: ReviewState, now = new Date()): number {
  if (!state.reviewCount || !state.reviewedAt) return Infinity
  const reviewed = new Date(state.reviewedAt).getTime()
  const due = state.reviewDueAt
    ? new Date(state.reviewDueAt).getTime()
    : reviewed + DAY
  const span = Math.max(due - reviewed, 60 * 1000)
  const ratio = (now.getTime() - reviewed) / span
  // Past its due date is due, however the dates got there.
  return now.getTime() >= due ? Math.max(1, ratio) : ratio
}

// How long since the note was last opened, as 0 (just now) to 1 (never,
// or at least STALE_DAYS ago).
const STALE_DAYS = 30
export function staleness(state: ReviewState, now = new Date()): number {
  if (!state.lastOpenedAt) return 1
  const days = (now.getTime() - new Date(state.lastOpenedAt).getTime()) / DAY
  return Math.min(1, Math.max(0, days / STALE_DAYS))
}
// How much a never (or long-ago) opened card is preferred: a reviewed
// card's priority is scaled by up to 1 + SEEN_BOOST, and a never-reviewed
// card gets up to SEEN_BOOST added to its random draw in [0, 1).
const SEEN_BOOST = 0.3

// Share of a deck given to never-reviewed cards when both kinds are
// available. Whatever one side can't fill goes to the other.
export const NEW_SHARE = 0.3
// Each reviewed card's priority is scaled by a random factor in
// [1 - JITTER, 1 + JITTER] before ranking, so when more cards are due
// than fit, the deck isn't the same strict order every time.
const JITTER = 0.35

// Picks a deck of `size` from the reviewed cards that are due (ranked by
// jittered priority, highest first) and the never-reviewed cards (random,
// leaning toward ones not opened lately), then shuffles the two together.
// A reviewed card never comes back before its due date; when too few are
// due, never-reviewed cards fill the deck.
export function buildDeck<T extends ReviewState>(
  reviewed: T[],
  unreviewed: T[],
  size: number,
  now = new Date(),
  rand: () => number = Math.random
): T[] {
  const ranked = reviewed
    .filter((card) => reviewPriority(card, now) >= 1)
    .map((card) => ({
      card,
      score:
        reviewPriority(card, now) *
        (1 + JITTER * (2 * rand() - 1)) *
        (1 + SEEN_BOOST * staleness(card, now)),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card)
  const fresh = unreviewed
    .map((card) => ({ card, score: rand() + SEEN_BOOST * staleness(card, now) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card)

  let newCount = Math.min(fresh.length, Math.round(size * NEW_SHARE))
  const oldCount = Math.min(ranked.length, size - newCount)
  newCount = Math.min(fresh.length, size - oldCount)

  return shuffle([...ranked.slice(0, oldCount), ...fresh.slice(0, newCount)], rand)
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
