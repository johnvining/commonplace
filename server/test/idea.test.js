import { describe, expect, it } from 'vitest'
import { authedAgent, createIdea, createNote } from './setup.js'

describe('idea', () => {
  describe('POST /api/idea/ (create)', () => {
    it('creates an idea', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/idea/').send({ name: 'curiosity' }).expect(201)
      expect(res.body.data.name).toBe('curiosity')
      expect(res.body.data._id).toBeDefined()
    })

    it('requires authentication', async () => {
      const agent = await authedAgent()
      await agent.post('/api/user/logout').expect(200)
      await agent.post('/api/idea/').send({ name: 'X' }).expect(401)
    })
  })

  describe('GET /api/idea/:id', () => {
    it('returns the idea', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent, 'Aesthetics')
      const res = await agent.get(`/api/idea/${idea._id}`).expect(200)
      expect(res.body.data.name).toBe('Aesthetics')
    })

    it('returns 400 for missing id', async () => {
      const agent = await authedAgent()
      await agent.get('/api/idea/507f1f77bcf86cd799439011').expect(400)
    })
  })

  describe('PUT /api/idea/:id (update)', () => {
    it('updates idea fields', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent, 'Original')
      await agent.put(`/api/idea/${idea._id}`).send({ name: 'Renamed' })
      const res = await agent.get(`/api/idea/${idea._id}`).expect(200)
      expect(res.body.data.name).toBe('Renamed')
    })
  })

  describe('DELETE /api/idea/:id/delete', () => {
    it('deletes the idea', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent, 'Doomed')
      await agent.delete(`/api/idea/${idea._id}/delete`).expect(204)
      await agent.get(`/api/idea/${idea._id}`).expect(400)
    })
  })

  describe('POST /api/idea/autocomplete', () => {
    it('finds ideas matching a substring', async () => {
      const agent = await authedAgent()
      await createIdea(agent, 'Aesthetics')
      await createIdea(agent, 'Ethics')
      const res = await agent.post('/api/idea/autocomplete').send({ string: 'aest' }).expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].name).toBe('Aesthetics')
    })

    it('returns empty array for no matches', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/idea/autocomplete').send({ string: 'xyzzy' }).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })

  describe('POST /api/idea/autocomplete/with-counts', () => {
    it('returns ideas with note_count', async () => {
      const agent = await authedAgent()
      await createIdea(agent, 'Aesthetics')
      const res = await agent.post('/api/idea/autocomplete/with-counts').send({ string: 'aest' }).expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].note_count).toBe(0)
    })
  })

  describe('GET /api/idea/:id/notes', () => {
    it('returns notes tagged with the idea', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent)
      const note = await createNote(agent, { title: 'Tagged note' })
      // Add idea to note
      await agent.put(`/api/note/${note._id}/idea`).send({ id: idea._id }).expect(200)
      const res = await agent.get(`/api/idea/${idea._id}/notes`).expect(200)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('returns empty array for idea with no notes', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent)
      const res = await agent.get(`/api/idea/${idea._id}/notes`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })
})
