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

// Year as YearSpan shows it: negative years are BC.
function formatYear(year: number): string {
  return year < 0 ? `${-year} BC` : String(year)
}

const asYear = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Short years label for picker rows, to tell same-named records apart
// (#315). Authors: "1924–2020", "b. 1962", "d. 1980". Ideas and piles:
// "1947–1991", "1947–", "–1991", or "1783" when both are the same year.
// Empty when there are no years.
export function yearsLabel(record: object): string {
  const item = record as Record<string, unknown>
  const birth = asYear(item.birth_year)
  const death = asYear(item.death_year)
  if (birth !== null || death !== null) {
    if (birth !== null && death !== null) return `${formatYear(birth)}–${formatYear(death)}`
    return birth !== null ? `b. ${formatYear(birth)}` : `d. ${formatYear(death!)}`
  }
  const start = asYear(item.start_year)
  const end = asYear(item.end_year)
  if (start === null && end === null) return ''
  if (start === end) return formatYear(start!)
  return `${start !== null ? formatYear(start) : ''}–${end !== null ? formatYear(end) : ''}`
}

// Spread onto text inputs that aren't credentials (pickers, the search
// bar) so browsers and password managers don't offer to fill or save
// them (#304). autoComplete="off" covers browsers; the data-* flags are
// the opt-outs LastPass, 1Password, Bitwarden and Dashlane honor.
export const NO_AUTOFILL = {
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
} as const
