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
