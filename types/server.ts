// Server-side type helpers. Models live next to their schemas; this file is
// for cross-cutting helpers — runtime augmentations on lean query results,
// shapes that exist only on the wire, etc.

// Annotated with the resolved nick string on top of a lean note (added by
// findNotesAndPopulate so callers can render note links by nick).
export type WithNick<T> = T & { nick?: string | null }

// Annotated with $meta:'textScore' from a $text query.
export type WithScore<T> = T & { score?: number }

// Annotated with note/work counts, used by autocomplete-with-counts endpoints.
export type WithCounts<T> = T & {
  note_count?: number
  work_count?: number
}

// Annotated with hybridScore + semantic flag from unifiedSearch's ranker.
export type WithHybrid<T> = T & {
  _hybridScore?: number
  _semantic?: boolean
}
