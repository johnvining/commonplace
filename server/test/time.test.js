import { describe, expect, it } from 'vitest'
import { authedAgent, createPile } from './setup.js'

function createEntry(agent, body) {
  return agent.post('/api/time/').send(body)
}

describe('time', () => {
  describe('POST /api/time/', () => {
    it('creates a title-only reading entry', async () => {
      const agent = await authedAgent()
      const res = await createEntry(agent, {
        title: 'Morning pages',
        kind: 'writing',
        minutes: 45,
        date: '2026-11-20',
      }).expect(201)
      expect(res.body.data).toMatchObject({
        title: 'Morning pages',
        kind: 'writing',
        minutes: 45,
      })
      expect(new Date(res.body.data.date).toISOString().slice(0, 10)).toBe('2026-11-20')
    })

    it('creates a pile-linked entry with no title', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent, 'Essay: Attention')
      const res = await createEntry(agent, {
        pile: pile._id,
        kind: 'reading',
        minutes: 30,
        date: '2026-11-20',
      }).expect(201)
      expect(String(res.body.data.pile?._id ?? res.body.data.pile)).toBe(String(pile._id))
      expect(res.body.data.pile?.name ?? pile.name).toBeTruthy()
    })

    it('400s when neither title nor pile is given', async () => {
      const agent = await authedAgent()
      const res = await createEntry(agent, { kind: 'reading', minutes: 10, date: '2026-11-20' })
      expect(res.status).toBe(400)
    })

    it('400s on bad kind, minutes, or date', async () => {
      const agent = await authedAgent()
      const bad = [
        { title: 'T', kind: 'research', minutes: 10, date: '2026-11-20' },
        { title: 'T', kind: 'reading', minutes: 0, date: '2026-11-20' },
        { title: 'T', kind: 'reading', minutes: 1.5, date: '2026-11-20' },
        { title: 'T', kind: 'reading', minutes: 10, date: 'not-a-day' },
      ]
      for (const body of bad) {
        await createEntry(agent, body).expect(400)
      }
    })
  })

  describe('GET /api/time/', () => {
    it('lists entries newest-day first and filters by kind and pile', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent, 'Essay: Attention')
      await createEntry(agent, { title: 'A', kind: 'reading', minutes: 10, date: '2026-11-20' })
      await createEntry(agent, { pile: pile._id, kind: 'writing', minutes: 20, date: '2026-11-21' })

      const all = await agent.get('/api/time/').expect(200)
      expect(all.body.data).toHaveLength(2)
      expect(all.body.data[0].minutes).toBe(20)

      const reading = await agent.get('/api/time/').query({ kind: 'reading' }).expect(200)
      expect(reading.body.data).toHaveLength(1)

      const byPile = await agent.get('/api/time/').query({ pile: pile._id }).expect(200)
      expect(byPile.body.data).toHaveLength(1)

      const range = await agent
        .get('/api/time/')
        .query({ from: '2026-11-21', to: '2026-11-21' })
        .expect(200)
      expect(range.body.data).toHaveLength(1)
      expect(range.body.data[0].minutes).toBe(20)
    })
  })

  describe('PUT and DELETE /api/time/:id', () => {
    it('updates minutes and kind, then deletes', async () => {
      const agent = await authedAgent()
      const created = await createEntry(agent, {
        title: 'Draft',
        kind: 'writing',
        minutes: 25,
        date: '2026-11-20',
      }).expect(201)
      const id = created.body.data._id

      const updated = await agent.put(`/api/time/${id}`).send({ minutes: 50 }).expect(200)
      expect(updated.body.data.minutes).toBe(50)

      await agent.delete(`/api/time/${id}`).expect(204)
      await agent.get(`/api/time/${id}`).expect(404)
    })

    it('refuses to clear the title off a pile-less entry', async () => {
      const agent = await authedAgent()
      const created = await createEntry(agent, {
        title: 'Draft',
        kind: 'writing',
        minutes: 25,
        date: '2026-11-20',
      }).expect(201)
      await agent.put(`/api/time/${created.body.data._id}`).send({ title: '  ' }).expect(400)
    })
  })

  describe('GET /api/time/summary', () => {
    it('returns daily and weekly totals split by kind and pile', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent, 'Essay: Attention')
      // Friday 2026-11-20 and Monday 2026-11-23 (next week) stay apart.
      await createEntry(agent, { title: 'Morning pages', kind: 'writing', minutes: 45, date: '2026-11-20' })
      await createEntry(agent, { pile: pile._id, kind: 'reading', minutes: 30, date: '2026-11-20' })
      await createEntry(agent, { pile: pile._id, kind: 'writing', minutes: 60, date: '2026-11-23' })

      const res = await agent.get('/api/time/summary').query({ date: '2026-11-20' }).expect(200)
      const { daily, weekly } = res.body.data

      expect(daily.date).toBe('2026-11-20')
      expect(daily.totalMinutes).toBe(75)
      expect(daily.readingMinutes).toBe(30)
      expect(daily.writingMinutes).toBe(45)
      expect(daily.byPile).toHaveLength(1)
      expect(daily.byPile[0]).toMatchObject({
        name: 'Essay: Attention',
        minutes: 30,
        readingMinutes: 30,
        writingMinutes: 0,
      })
      expect(daily.byTitle).toHaveLength(1)
      expect(daily.byTitle[0]).toMatchObject({ title: 'Morning pages', minutes: 45 })

      // Week of Mon 2026-11-16 … Sun 2026-11-22: excludes the Monday entry.
      expect(weekly.weekStart).toBe('2026-11-16')
      expect(weekly.totalMinutes).toBe(75)
      expect(weekly.byDay).toHaveLength(7)
      const friday = weekly.byDay.find((d) => d.date === '2026-11-20')
      expect(friday.totalMinutes).toBe(75)

      const nextWeek = await agent
        .get('/api/time/summary')
        .query({ date: '2026-11-23' })
        .expect(200)
      expect(nextWeek.body.data.daily.totalMinutes).toBe(60)
      expect(nextWeek.body.data.weekly.byPile[0]).toMatchObject({
        name: 'Essay: Attention',
        minutes: 60,
      })
    })

    it('400s on a bad date', async () => {
      const agent = await authedAgent()
      await agent.get('/api/time/summary').query({ date: 'yesterday' }).expect(400)
    })
  })
})
