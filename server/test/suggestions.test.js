import { describe, expect, it } from 'vitest'
import { cleanSuggestedTitle } from '../src/utils/suggestions.js'

describe('cleanSuggestedTitle', () => {
  it('trims surrounding whitespace', () => {
    expect(cleanSuggestedTitle('A short summary ')).toBe('A short summary')
    expect(cleanSuggestedTitle('\n A short summary\n')).toBe('A short summary')
  })

  it('strips wrapping quotes', () => {
    expect(cleanSuggestedTitle('"A short summary" ')).toBe('A short summary')
    expect(cleanSuggestedTitle('“A short summary”')).toBe('A short summary')
  })

  it("keeps quotes and apostrophes inside the title", () => {
    expect(cleanSuggestedTitle("Plato's \"Republic\" on justice")).toBe("Plato's \"Republic\" on justice")
  })

  it('keeps a quote that ends the title but does not wrap it', () => {
    expect(cleanSuggestedTitle('On "Republic"')).toBe('On "Republic"')
  })

  it('passes null through', () => {
    expect(cleanSuggestedTitle(null)).toBe(null)
  })
})
