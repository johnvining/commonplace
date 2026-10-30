import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createIdea, createNote } from './setup.js'
import Note from '../src/resources/note/note.model.js'
import { buildDeck, reviewPriority, scheduleReview, staleness } from '../src/utils/review.js'

vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

const DAY = 24 * 60 * 60 * 1000
const now = new Date('2026-06-01T00:00:00Z')
const ago = (days) => new Date(now.getTime() - days * DAY)
const half = () => 0.5 // no fuzz, no jitter

describe('scheduleReview', () => {
  it('sends a fast card back in a day and a slow one out further', () => {
    const fast = scheduleReview({}, 'fast', now, half)
    const med = scheduleReview({}, 'med', now, half)
    const slow = scheduleReview({}, 'slow', now, half)
    expect(fast.reviewInterval).toBe(1)
    expect(med.reviewInterval).toBe(3)
    expect(slow.reviewInterval).toBe(7)
    expect(slow.reviewDueAt.getTime()).toBe(now.getTime() + 7 * DAY)
    expect(slow.reviewCount).toBe(1)
    expect(slow.touchedAt).toEqual(now)
  })

  it('grows the interval by ease on slow and lowers ease on fast', () => {
    const slow = scheduleReview({ reviewInterval: 10, reviewEase: 2, reviewCount: 4 }, 'slow', now, half)
    expect(slow.reviewInterval).toBe(20)
    expect(slow.reviewEase).toBeCloseTo(2.15)
    expect(slow.reviewCount).toBe(5)
    const fast = scheduleReview({ reviewInterval: 10, reviewEase: 1.4 }, 'fast', now, half)
    expect(fast.reviewEase).toBe(1.3)
  })

  it('fuzzes intervals', () => {
    expect(scheduleReview({}, 'slow', now, () => 0).reviewInterval).toBeCloseTo(7 * 0.85)
    expect(scheduleReview({}, 'slow', now, () => 0.9999).reviewInterval).toBeCloseTo(7 * 1.15)
  })
})

describe('buildDeck', () => {
  it('ranks overdue reviewed cards first', () => {
    const due = { id: 'due', reviewedAt: ago(10), reviewDueAt: ago(0) }
    const overdue = { id: 'overdue', reviewedAt: ago(10), reviewDueAt: ago(5) }
    const fresh = { id: 'fresh', reviewedAt: ago(1), reviewDueAt: ago(-9) }
    expect(reviewPriority(overdue, now)).toBe(2)
    const deck = buildDeck([fresh, due, overdue], [], 2, now, half)
    expect(deck.map((c) => c.id).sort()).toEqual(['due', 'overdue'])
  })

  it('mixes never-reviewed cards in, and fills from either side', () => {
    const reviewed = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, reviewedAt: ago(5), reviewDueAt: ago(1) }))
    const unreviewed = Array.from({ length: 50 }, (_, i) => ({ id: `u${i}` }))
    const deck = buildDeck(reviewed, unreviewed, 40, now)
    expect(deck).toHaveLength(40)
    expect(deck.filter((c) => c.id.startsWith('u'))).toHaveLength(12)
    expect(buildDeck(reviewed, unreviewed.slice(0, 3), 40, now).filter((c) => c.id.startsWith('u'))).toHaveLength(3)
    expect(buildDeck(reviewed.slice(0, 2), unreviewed, 40, now).filter((c) => c.id.startsWith('u'))).toHaveLength(38)
  })

  it('leans toward cards not seen lately', () => {
    expect(staleness({}, now)).toBe(1)
    expect(staleness({ seenAt: ago(15) }, now)).toBe(0.5)
    const seen = { id: 'seen', seenAt: ago(0) }
    const unseen = { id: 'unseen' }
    expect(buildDeck([], [seen, unseen], 1, now, half)[0].id).toBe('unseen')
  })
})

describe('review endpoints', () => {
  it('records a rating without touching updatedAt', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'card' })
    const res = await agent.post(`/api/note/${note._id}/review`).send({ rating: 'slow' }).expect(200)
    expect(res.body.data.reviewCount).toBe(1)
    const after = await Note.findById(note._id).lean()
    expect(after.reviewedAt).toBeTruthy()
    expect(after.reviewDueAt.getTime()).toBeGreaterThan(Date.now())
    expect(after.touchedAt).toBeTruthy()
    expect(after.updatedAt.toISOString()).toBe(note.updatedAt)
  })

  it('rejects bad ratings and unknown notes', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'card' })
    await agent.post(`/api/note/${note._id}/review`).send({ rating: 'soon' }).expect(400)
    await agent.post('/api/note/507f1f77bcf86cd799439011/review').send({ rating: 'fast' }).expect(404)
    await agent.put(`/api/note/${note._id}`).send({ reviewedAt: new Date() }).expect(400)
  })

  it('resets reviewedAt when the note is edited', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'card' })
    await Note.updateOne({ _id: note._id }, { $set: { reviewedAt: ago(30), reviewInterval: 10 } })
    await agent.put(`/api/note/${note._id}`).send({ text: 'edited' }).expect(200)
    let after = await Note.findById(note._id).lean()
    expect(Date.now() - after.reviewedAt.getTime()).toBeLessThan(60 * 1000)
    expect(after.reviewDueAt.getTime() - after.reviewedAt.getTime()).toBe(10 * DAY)

    const idea = await createIdea(agent, 'I')
    await Note.updateOne({ _id: note._id }, { $set: { reviewedAt: ago(30) } })
    await agent.put(`/api/note/${note._id}/idea`).send({ id: idea._id }).expect(200)
    after = await Note.findById(note._id).lean()
    expect(Date.now() - after.reviewedAt.getTime()).toBeLessThan(60 * 1000)
    expect(after.ideas.map(String)).toEqual([String(idea._id)])
  })

  it('deals a deck of reviewed and never-reviewed notes', async () => {
    const agent = await authedAgent()
    const a = await createNote(agent, { title: 'A' })
    await createNote(agent, { title: 'B' })
    await agent.post(`/api/note/${a._id}/review`).send({ rating: 'fast' }).expect(200)
    const res = await agent.get('/api/note/flip').expect(200)
    expect(res.body.data.map((n) => n.title).sort()).toEqual(['A', 'B'])
  })
})
