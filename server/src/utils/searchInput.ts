// Common input shaping for free-text search endpoints. Cap length to prevent
// CPU exhaustion via pathological regex / $text input, and coerce to string
// so callers can `.replace(...)` without checking type first.

const MAX_SEARCH_LENGTH = 200

export function sanitizeSearchInput(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.slice(0, MAX_SEARCH_LENGTH)
}

// For values going into `new RegExp(...)`. Escapes regex meta-chars in addition
// to capping length.
const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g
export function escapeRegexInput(input: unknown): string {
  return sanitizeSearchInput(input).replace(REGEX_ESCAPE, '\\$&')
}

// Order name matches for a picker: the exact name first (ignoring case
// and surrounding spaces), then names starting with the query, then the
// rest, alphabetically within each group. Without this an exact match
// could sit below dozens of partial ones, out of view (#255).
export function rankByName<T extends { name?: string | null }>(docs: T[], query: string): T[] {
  const q = (query ?? '').trim().toLowerCase()
  const rank = (name: string) => (name === q ? 0 : name.startsWith(q) ? 1 : 2)
  return docs
    .map((doc) => ({ doc, name: (doc.name ?? '').trim().toLowerCase() }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .map(({ doc }) => doc)
}
