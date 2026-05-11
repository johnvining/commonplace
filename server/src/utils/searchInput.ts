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
