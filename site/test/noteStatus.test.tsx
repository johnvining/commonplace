import { describe, it, expect } from 'vitest'
import { noteStatus } from '../noteStatus'

const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

describe('noteStatus review part (#380)', () => {
  it("uses the server's review state", () => {
    expect(noteStatus({ reviewState: 'unreviewed', reviewedAt: ago(1), reviewCount: 0 })).toContain('never reviewed')
    expect(noteStatus({ reviewState: 'overdue', reviewedAt: ago(40), reviewDueAt: ago(20), reviewCount: 1 })).toContain('overdue (due')
    expect(noteStatus({ reviewState: 'scheduled', reviewedAt: ago(1), reviewDueAt: ago(-5), reviewCount: 2 })).toContain('due in 5 days')
  })

  it('falls back to the rating count without one', () => {
    expect(noteStatus({ reviewedAt: ago(1) })).toContain('never reviewed')
  })
})
