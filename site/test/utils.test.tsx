import { describe, it, expect } from 'vitest'
import { formatYear, yearsLabel, retiredNickMessage, titleSourceOf, isAiTitleSource } from '../utils'

describe('formatYear', () => {
  it('shows years before 1 as BC (#361)', () => {
    expect(formatYear(-300)).toBe('300 BC')
    expect(formatYear('-300')).toBe('300 BC')
  })

  it('leaves CE years and missing years alone', () => {
    expect(formatYear(1999)).toBe('1999')
    expect(formatYear(undefined)).toBe('')
  })

  it('applies to year ranges', () => {
    expect(yearsLabel({ birth_year: -384, death_year: -322 })).toBe('384 BC–322 BC')
  })
})

describe('retiredNickMessage (#366)', () => {
  it('names what a deleted nick pointed to', () => {
    expect(retiredNickMessage('w123456', { name: 'Bowling Alone', retiredAt: null }))
      .toBe('w123456 pointed to “Bowling Alone”, which was deleted.')
    expect(retiredNickMessage('w123456', { name: 'X', retiredAt: '2026-11-03T12:00:00Z' })).toMatch(/deleted on .*2026\.$/)
  })

  it('says less for nicks retired before names were kept', () => {
    expect(retiredNickMessage('n1', {})).toBe('n1 pointed to something that has since been deleted.')
  })
})

describe('titleSourceOf (#370)', () => {
  it('uses the recorded source, never the title', () => {
    expect(titleSourceOf({ titleSource: 'user' })).toBe('user')
    expect(titleSourceOf({ titleSource: 'ai-accepted' })).toBe('ai-accepted')
    expect(titleSourceOf({ titleSource: 'ai-suggested' })).toBe('ai-suggested')
    expect(titleSourceOf({})).toBe(null)
    expect(isAiTitleSource(null)).toBe(false)
    expect(isAiTitleSource('user')).toBe(false)
    expect(isAiTitleSource('ai-accepted')).toBe(true)
  })
})
