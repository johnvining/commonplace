export function guessYearFromURL(url) {
  if (!url) return

  let val
  const array = [...url.matchAll(/(?<=\/)(\d){4}(?=\D)/g)]
  if (array.length == 1) {
    val = array[0][0]
  }

  //TODO: Also match 8 digit dates: 20200101, 01012020, 12312020, 31122020

  if (isNaN(val) || val === null || val === undefined) return null
  if (val > 2030 || val < 1990) return null
  return val
}
