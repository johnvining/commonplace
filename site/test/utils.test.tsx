import { describe, it, expect } from 'vitest'
import { formatYear, yearsLabel } from '../utils'

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
