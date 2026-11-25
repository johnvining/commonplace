import { describe, expect, it } from 'vitest'
import { wordPrefixFilter } from '../src/utils/searchInput.js'

function namesMatching(field, query, names) {
  const filter = wordPrefixFilter(field, query)
  const anded = (filter.$and ?? []).map((c) => c[field])
  if (!anded.length) return []
  return names.filter((n) => anded.every((re) => re.test(n)))
}

const PILES = ['Piece: Foo', 'Essay: piece work', 'My Piece', 'Unrelated']

describe('wordPrefixFilter', () => {
  it('ignores trailing punctuation, so piece: finds piece piles', () => {
    expect(namesMatching('name', 'piece:', PILES).sort()).toEqual(
      ['Piece: Foo', 'Essay: piece work', 'My Piece'].sort()
    )
    expect(namesMatching('name', 'piece', PILES).sort()).toEqual(
      ['Piece: Foo', 'Essay: piece work', 'My Piece'].sort()
    )
  })

  it('still requires every word to match a word start', () => {
    expect(namesMatching('name', 'don ha', ['Donald Hall', 'All Done'])).toEqual(['Donald Hall'])
  })

  it('matches nothing for an empty or punctuation-only query', () => {
    expect(namesMatching('name', '   ', PILES)).toEqual([])
    expect(namesMatching('name', ':', PILES)).toEqual([])
  })
})
