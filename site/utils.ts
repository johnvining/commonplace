export function guessYearFromURL(url: string | undefined): number | null {
  if (!url) return null

  let val: number | undefined
  // A 4-digit year right after a slash. Don't use a lookbehind like
  // (?<=\/): Safari before 16.4 (older iPads) throws on it (#102).
  const matches = [...url.matchAll(/\/(\d{4})(?=\D|$)/g)]
  if (matches.length === 1) {
    val = parseInt(matches[0][1], 10)
  }

  //TODO: Also match 8 digit dates: 20200101, 01012020, 12312020, 31122020

  if (val === undefined || isNaN(val)) return null
  // Same range as the server's guessYearFromUrl.
  if (val < 1900 || val > new Date().getFullYear() + 1) return null
  return val
}

// Browser tab title with the nick first ("n12345 — My note"), so tabs,
// history and bookmarks can be found by nick (#318).
export function titleWithNick(title: string, nick?: string | null): string {
  return nick ? `${nick} — ${title}` : title
}

// Tab title for a note: its title, else its text, else "Untitled Note".
export function notePageTitle(note: { title?: string; text?: string; nick?: string | null }): string {
  const label = note.title || note.text || 'Untitled Note'
  return titleWithNick(label, note.nick)
}
