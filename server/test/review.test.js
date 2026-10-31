import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createIdea, createNote } from './setup.js'
import Note from '../src/resources/note/note.model.js'
import { NEVER_REVIEWED, REVIEWED, buildDeck, reviewPriority, scheduleReview, staleness } from '../src/utils/review.js'

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
    const due = { id: 'due', reviewedAt: ago(10), reviewDueAt: ago(0), reviewCount: 1 }
    const overdue = { id: 'overdue', reviewedAt: ago(10), reviewDueAt: ago(5), reviewCount: 1 }
    const fresh = { id: 'fresh', reviewedAt: ago(1), reviewDueAt: ago(-9), reviewCount: 1 }
    expect(reviewPriority(overdue, now)).toBe(2)
    const deck = buildDeck([fresh, due, overdue], [], 2, now, half)
    expect(deck.map((c) => c.id).sort()).toEqual(['due', 'overdue'])
  })

  it('mixes never-reviewed cards in, and fills from either side', () => {
    const reviewed = Array.from({ length: 50 }, (_, i) => ({ id: `r${i}`, reviewedAt: ago(5), reviewDueAt: ago(1), reviewCount: 1 }))
    const unreviewed = Array.from({ length: 50 }, (_, i) => ({ id: `u${i}` }))
    const deck = buildDeck(reviewed, unreviewed, 40, now)
    expect(deck).toHaveLength(40)
    expect(deck.filter((c) => c.id.startsWith('u'))).toHaveLength(12)
    expect(buildDeck(reviewed, unreviewed.slice(0, 3), 40, now).filter((c) => c.id.startsWith('u'))).toHaveLength(3)
    expect(buildDeck(reviewed.slice(0, 2), unreviewed, 40, now).filter((c) => c.id.startsWith('u'))).toHaveLength(38)
  })

  it('treats a reviewedAt without any ratings as never reviewed', () => {
    expect(reviewPriority({ reviewedAt: ago(1), reviewDueAt: ago(-1) }, now)).toBe(Infinity)
    expect(reviewPriority({ reviewedAt: ago(1), reviewDueAt: ago(-1), reviewCount: 1 }, now)).toBe(0.5)
  })

  it('leans toward cards not seen lately', () => {
    expect(staleness({}, now)).toBe(1)
    expect(staleness({ lastOpenedAt: ago(15) }, now)).toBe(0.5)
    const seen = { id: 'seen', lastOpenedAt: ago(0) }
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
    expect(after.updatedAt.toISOString()).toBe(note.updatedAt)
  })

  it('rejects bad ratings and unknown notes', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'card' })
    await agent.post(`/api/note/${note._id}/review`).send({ rating: 'soon' }).expect(400)
    await agent.post('/api/note/507f1f77bcf86cd799439011/review').send({ rating: 'fast' }).expect(404)
    await agent.put(`/api/note/${note._id}`).send({ reviewedAt: new Date() }).expect(400)
  })

  it('counts only opening a note, not loading it in lists or decks', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'card' })
    await agent.get(`/api/note/${note._id}`).expect(200)
    await agent.get('/api/note/all/1').expect(200)
    await agent.get('/api/note/flip').expect(200)
    let after = await Note.findById(note._id).lean()
    expect(after.openCount ?? 0).toBe(0)
    expect(after.lastOpenedAt).toBeUndefined()
    await agent.post(`/api/note/${note._id}/opened`).expect(200)
    after = await Note.findById(note._id).lean()
    expect(after.openCount).toBe(1)
    expect(after.lastOpenedAt).toBeTruthy()
    expect(after.reviewedAt).toBeUndefined()
  })

  it('leaves the review schedule alone when the note is edited', async () => {
    const agent = await authedAgent()
    const fresh = await createNote(agent, { title: 'new card' })
    await agent.put(`/api/note/${fresh._id}`).send({ text: 'edited' }).expect(200)
    expect((await Note.findById(fresh._id).lean()).reviewedAt).toBeUndefined()

    const note = await createNote(agent, { title: 'card' })
    const schedule = { reviewedAt: ago(30), reviewDueAt: ago(20), reviewInterval: 10 }
    await Note.updateOne({ _id: note._id }, { $set: schedule })
    await agent.put(`/api/note/${note._id}`).send({ text: 'edited' }).expect(200)
    const idea = await createIdea(agent, 'I')
    await agent.put(`/api/note/${note._id}/idea`).send({ id: idea._id }).expect(200)
    const after = await Note.findById(note._id).lean()
    expect(after.reviewedAt).toEqual(schedule.reviewedAt)
    expect(after.reviewDueAt).toEqual(schedule.reviewDueAt)
    expect(after.text).toBe('edited')
  })

  it('sorts notes into reviewed and never reviewed by their ratings', async () => {
    const agent = await authedAgent()
    const rated = await createNote(agent, { title: 'rated' })
    const editedOnly = await createNote(agent, { title: 'edited only' })
    const untouched = await createNote(agent, { title: 'untouched' })
    await agent.post(`/api/note/${rated._id}/review`).send({ rating: 'med' }).expect(200)
    // Left by an earlier version, which set reviewedAt on edits.
    await Note.collection.updateOne({ _id: editedOnly._id }, { $set: { reviewedAt: ago(1), reviewDueAt: ago(-1) } })
    const titles = async (filter) => (await Note.find(filter).lean()).map((n) => n.title).sort()
    expect(await titles(REVIEWED)).toEqual(['rated'])
    expect(await titles(NEVER_REVIEWED)).toEqual(['edited only', 'untouched'])
    expect(untouched.reviewCount).toBe(0)
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
