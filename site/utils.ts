export function guessYearFromURL(url: string | undefined): number | null {
  if (!url) return null

  let val: number | undefined
  const matches = [...url.matchAll(/\/(\d{4})(?=\D|$)/g)]
  if (matches.length === 1) {
    val = parseInt(matches[0][1], 10)
  }

  //TODO: Also match 8 digit dates: 20200101, 01012020, 12312020, 31122020

  if (val === undefined || isNaN(val)) return null
  if (val > 2030 || val < 1990) return null
  return val
}
