// Spaced review for /flip: a small Anki-style scheduler.
//
// Each note carries
// - reviewedAt: when it was last rated,
// - reviewDueAt: the next review target,
// - reviewInterval: days between reviewedAt and reviewDueAt,
// - reviewEase: how fast the interval grows when it's rated "slow",
// - reviewCount: how many times it has been rated,
// - seenAt / seenCount: the last time, and how often, it was loaded
//   anywhere (see utils/seen.ts), rated or not.
// Only a rating moves these: editing a note (updatedAt) or seeing it
// doesn't. A note is reviewed once reviewCount > 0. Don't go by
// reviewedAt alone: an earlier version set it on edits too, so older
// notes can have one without ever being rated.

export const REVIEWED = { reviewCount: { $gt: 0 } }
export const NEVER_REVIEWED = { reviewCount: { $not: { $gt: 0 } } }

const DAY = 24 * 60 * 60 * 1000

export const RATINGS = ['fast', 'med', 'slow'] as const
export type Rating = (typeof RATINGS)[number]

export const DEFAULT_EASE = 2.5
const MIN_EASE = 1.3
const MAX_EASE = 3.5
// Intervals are randomized by up to this fraction either way, so cards
// rated together don't keep coming back together.
const FUZZ = 0.15

export interface ReviewState {
  reviewedAt?: Date | null
  reviewDueAt?: Date | null
  reviewInterval?: number | null
  reviewEase?: number | null
  reviewCount?: number | null
  seenAt?: Date | null
}

export interface ReviewUpdate {
  reviewedAt: Date
  reviewDueAt: Date
  reviewInterval: number
  reviewEase: number
  reviewCount: number
}

// The rating is how soon to see the card again:
// - fast: back to a day, and grow more slowly from now on.
// - med: a modest step up.
// - slow: a full step up, and grow faster from now on.
export function scheduleReview(
  state: ReviewState,
  rating: Rating,
  now = new Date(),
  rand: () => number = Math.random
): ReviewUpdate {
  const interval = state.reviewInterval || 0
  let ease = state.reviewEase || DEFAULT_EASE
  let next: number
  switch (rating) {
    case 'fast':
      next = 1
      ease -= 0.2
      break
    case 'med':
      next = Math.max(3, interval * 1.2)
      break
    case 'slow':
      next = Math.max(7, interval * ease)
      ease += 0.15
      break
  }
  ease = Math.min(MAX_EASE, Math.max(MIN_EASE, ease))
  next = next * (1 + FUZZ * (2 * rand() - 1))
  next = Math.round(next * 100) / 100

  return {
    reviewedAt: now,
    reviewDueAt: new Date(now.getTime() + next * DAY),
    reviewInterval: next,
    reviewEase: ease,
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
  return (now.getTime() - reviewed) / span
}

// How long since the card was last seen, as 0 (just now) to 1 (never, or
// at least STALE_DAYS ago).
const STALE_DAYS = 30
export function staleness(state: ReviewState, now = new Date()): number {
  if (!state.seenAt) return 1
  const days = (now.getTime() - new Date(state.seenAt).getTime()) / DAY
  return Math.min(1, Math.max(0, days / STALE_DAYS))
}
// How much an unseen (or long-unseen) card is preferred: a reviewed
// card's priority is scaled by up to 1 + SEEN_BOOST, and a never-reviewed
// card gets up to SEEN_BOOST added to its random draw in [0, 1).
const SEEN_BOOST = 0.3

// Share of a deck given to never-reviewed cards when both kinds are
// available. Whatever one side can't fill goes to the other.
export const NEW_SHARE = 0.3
// Each reviewed card's priority is scaled by a random factor in
// [1 - JITTER, 1 + JITTER] before ranking, so the deck isn't the same
// strict order every time and near-due cards sometimes get in ahead of
// barely-overdue ones.
const JITTER = 0.35

// Picks a deck of `size` from the reviewed cards (ranked by jittered
// priority, highest first) and the never-reviewed cards (random, leaning
// toward ones not seen lately), then shuffles the two together.
export function buildDeck<T extends ReviewState>(
  reviewed: T[],
  unreviewed: T[],
  size: number,
  now = new Date(),
  rand: () => number = Math.random
): T[] {
  const ranked = reviewed
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
