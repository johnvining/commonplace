export const guessYearFromUrl = function (url) {
  try {
    // Match a 4-digit year after a slash, not followed by another digit
    const matches = [...url.matchAll(/\/(\d{4})(?=\D|$)/g)]
    if (matches.length === 1) {
      const year = parseInt(matches[0][1], 10)
      if (year >= 1900 && year <= new Date().getFullYear() + 1) return year
    }
  } catch {}
  return null
}
