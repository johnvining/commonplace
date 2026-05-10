import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createWork } from './setup.js'

describe('auth (authors)', () => {
  describe('POST /api/auth/ (create)', () => {
    it('creates an author', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/auth/').send({ name: 'Aristotle' }).expect(201)
      expect(res.body.data.name).toBe('Aristotle')
      expect(res.body.data._id).toBeDefined()
    })

    it('requires authentication', async () => {
      const agent = await authedAgent()
      await agent.post('/api/user/logout').expect(200)
      await agent.post('/api/auth/').send({ name: 'X' }).expect(401)
    })
  })

  describe('GET /api/auth/:id', () => {
    it('returns the author', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'Plato')
      const res = await agent.get(`/api/auth/${author._id}`).expect(200)
      expect(res.body.data.name).toBe('Plato')
    })

    it('returns 400 for missing id', async () => {
      const agent = await authedAgent()
      await agent.get('/api/auth/507f1f77bcf86cd799439011').expect(400)
    })
  })

  describe('PUT /api/auth/:id (update)', () => {
    it('updates author fields', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'Original')
      await agent.put(`/api/auth/${author._id}`).send({ name: 'Renamed' })
      const res = await agent.get(`/api/auth/${author._id}`).expect(200)
      expect(res.body.data.name).toBe('Renamed')
    })
  })

  describe('DELETE /api/auth/:id/delete', () => {
    it('deletes the author', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'Doomed')
      await agent.delete(`/api/auth/${author._id}/delete`).expect(204)
      await agent.get(`/api/auth/${author._id}`).expect(400)
    })
  })

  describe('POST /api/auth/autocomplete', () => {
    it('finds authors matching a substring', async () => {
      const agent = await authedAgent()
      await createAuthor(agent, 'Aristotle')
      await createAuthor(agent, 'Plato')
      const res = await agent.post('/api/auth/autocomplete').send({ string: 'aris' }).expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].name).toBe('Aristotle')
    })

    it('returns empty array for no matches', async () => {
      const agent = await authedAgent()
      await createAuthor(agent, 'Aristotle')
      const res = await agent.post('/api/auth/autocomplete').send({ string: 'xyzzy' }).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })

  describe('POST /api/auth/autocomplete/with-counts', () => {
    it('returns authors with note_count and work_count', async () => {
      const agent = await authedAgent()
      await createAuthor(agent, 'Aristotle')
      const res = await agent.post('/api/auth/autocomplete/with-counts').send({ string: 'aris' }).expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].note_count).toBe(0)
      expect(res.body.data[0].work_count).toBe(0)
    })
  })

  describe('GET /api/auth/:id/notes', () => {
    it('returns notes belonging to the author', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'Author1')
      // Create a note attached to the author
      await agent.post('/api/note/').send({ author: author._id, title: 'My Note' }).expect(201)
      const res = await agent.get(`/api/auth/${author._id}/notes`).expect(200)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('returns empty array for author with no notes', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent)
      const res = await agent.get(`/api/auth/${author._id}/notes`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })

  describe('GET /api/auth/:id/all-notes', () => {
    it('includes notes via author and via works of that author', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'Author1')
      // Note attached directly
      await agent.post('/api/note/').send({ author: author._id, title: 'Direct' }).expect(201)
      // Work + note attached to that work
      const work = await createWork(agent, { name: 'Some Work', author: author._id })
      await agent.post('/api/note/').send({ work: work._id, title: 'Via work' }).expect(201)

      const res = await agent.get(`/api/auth/${author._id}/all-notes`).expect(200)
      expect(res.body.data.length).toBe(2)
    })
  })

  describe('GET /api/auth/:id/works', () => {
    it('returns works for the author', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent)
      await createWork(agent, { name: 'W1', author: author._id })
      await createWork(agent, { name: 'W2', author: author._id })
      const res = await agent.get(`/api/auth/${author._id}/works`).expect(200)
      expect(res.body.data.length).toBe(2)
    })

    it('returns empty array when author has no works', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent)
      const res = await agent.get(`/api/auth/${author._id}/works`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })
})
