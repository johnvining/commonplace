import { describe, expect, it } from 'vitest'
import { authedAgent, createPile, createNote, createWork } from './setup.js'

describe('pile', () => {
  describe('POST /api/pile/ (create / find-or-create)', () => {
    it('creates a pile', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/pile/').send({ name: 'reading' }).expect(201)
      expect(res.body.data.name).toBe('reading')
      expect(res.body.data._id).toBeDefined()
    })

    it('returns existing pile for duplicate name (upsert behavior)', async () => {
      const agent = await authedAgent()
      const first = await createPile(agent, 'reading')
      const second = await createPile(agent, 'reading')
      expect(String(second._id)).toBe(String(first._id))
    })

    it('rejects empty name (returns 400)', async () => {
      const agent = await authedAgent()
      await agent.post('/api/pile/').send({ name: '' }).expect(400)
    })

    it('requires authentication', async () => {
      const agent = await authedAgent()
      await agent.post('/api/user/logout').expect(200)
      await agent.post('/api/pile/').send({ name: 'X' }).expect(401)
    })
  })

  describe('GET /api/pile/:id', () => {
    it('returns the pile', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent, 'NamedPile')
      const res = await agent.get(`/api/pile/${pile._id}`).expect(200)
      expect(res.body.data.name).toBe('NamedPile')
    })
  })

  describe('PUT /api/pile/:id', () => {
    it('updates pile fields', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent, 'Old')
      await agent.put(`/api/pile/${pile._id}`).send({ name: 'New' })
      const res = await agent.get(`/api/pile/${pile._id}`).expect(200)
      expect(res.body.data.name).toBe('New')
    })
  })

  describe('DELETE /api/pile/:id', () => {
    it('deletes the pile', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent, 'Doomed')
      await agent.delete(`/api/pile/${pile._id}`).expect(204)
      await agent.get(`/api/pile/${pile._id}`).expect(400)
    })
  })

  describe('POST /api/pile/autocomplete', () => {
    it('finds piles matching a substring', async () => {
      const agent = await authedAgent()
      await createPile(agent, 'reading')
      await createPile(agent, 'writing')
      const res = await agent.post('/api/pile/autocomplete').send({ string: 'read' }).expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].name).toBe('reading')
    })

    it('returns empty array for no matches', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/pile/autocomplete').send({ string: 'xyzzy' }).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })

  describe('POST /api/pile/autocomplete/with-counts', () => {
    it('returns piles with note_count and work_count', async () => {
      const agent = await authedAgent()
      await createPile(agent, 'reading')
      const res = await agent.post('/api/pile/autocomplete/with-counts').send({ string: 'read' }).expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].note_count).toBe(0)
      expect(res.body.data[0].work_count).toBe(0)
    })
  })

  describe('GET /api/pile/all', () => {
    it('returns all piles', async () => {
      const agent = await authedAgent()
      await createPile(agent, 'p1')
      await createPile(agent, 'p2')
      const res = await agent.get('/api/pile/all').expect(200)
      expect(res.body.data.length).toBe(2)
    })
  })

  describe('GET /api/pile/:id/notes', () => {
    it('returns notes attached to the pile', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent)
      const note = await createNote(agent, { title: 'Note in pile' })
      await agent.put(`/api/note/${note._id}/pile`).send({ id: pile._id }).expect(200)
      const res = await agent.get(`/api/pile/${pile._id}/notes`).expect(200)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('returns empty array for pile with no notes', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent)
      const res = await agent.get(`/api/pile/${pile._id}/notes`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })

  describe('GET /api/pile/:id/works', () => {
    it('returns works attached to the pile', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent)
      const work = await createWork(agent, { name: 'Work in pile' })
      await agent.put(`/api/work/${work._id}/pile`).send({ id: pile._id }).expect(200)
      const res = await agent.get(`/api/pile/${pile._id}/works`).expect(200)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('returns empty array for pile with no works', async () => {
      const agent = await authedAgent()
      const pile = await createPile(agent)
      const res = await agent.get(`/api/pile/${pile._id}/works`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })
})
