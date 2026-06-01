// Shared helpers for rendering ordered author lists.
//
// Notes and works carry an authors[] array — order matters because that's
// the citation order. Most display call sites just want a string for
// non-link contexts, or the array itself for linked rendering.

export interface AuthorLike {
  _id?: string
  name?: string | null
}

// Single string: "Smith, J. & Jones, A." for 2; "Smith, J., Jones, A. & Brown, B."
// for 3+. Empty list → empty string. Skips entries with no name.
export function joinAuthorNames(authors: AuthorLike[] | null | undefined): string {
  const names = (authors ?? [])
    .map((a) => (a && typeof a === 'object' ? a.name : null))
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return names[0] + ' & ' + names[1]
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1]
}

// First populated author or null. Convenience for legacy "author name"
// callers that haven't been updated to render the full list yet.
export function firstAuthor(authors: AuthorLike[] | null | undefined): AuthorLike | null {
  if (!authors || !authors.length) return null
  const first = authors[0]
  return first && typeof first === 'object' ? first : null
}

// Author list with note.work fallback — preserves the historical
// "if the note has no author of its own, inherit from its work" rule.
export function authorsWithWorkFallback(
  noteAuthors: AuthorLike[] | null | undefined,
  workAuthors: AuthorLike[] | null | undefined
): AuthorLike[] {
  if (noteAuthors && noteAuthors.length) return noteAuthors
  return workAuthors ?? []
}
