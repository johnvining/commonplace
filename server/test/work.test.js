import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createPile, createWork, createNote } from './setup.js'

describe('work', () => {
  describe('POST /api/work/ (create)', () => {
    it('creates a work', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/work/').send({ name: 'Some Book' }).expect(201)
      expect(res.body.data.name).toBe('Some Book')
      expect(res.body.data._id).toBeDefined()
    })

    it('requires authentication', async () => {
      const agent = await authedAgent()
      await agent.post('/api/user/logout').expect(200)
      await agent.post('/api/work/').send({ name: 'X' }).expect(401)
    })
  })

  describe('GET /api/work/:id', () => {
    it('returns work with populated authors and piles', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'WorkAuthor')
      const work = await createWork(agent, { name: 'WithAuthor', authors: [author._id] })
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.name).toBe('WithAuthor')
      expect(res.body.data.authors?.[0]?._id).toBe(String(author._id))
    })

    it('returns 400 for missing id', async () => {
      const agent = await authedAgent()
      await agent.get('/api/work/507f1f77bcf86cd799439011').expect(400)
    })
  })

  describe('PUT /api/work/:id (update)', () => {
    it('updates name', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'Old' })
      await agent.put(`/api/work/${work._id}`).send({ name: 'New' }).expect(200)
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.name).toBe('New')
    })

    it('infers authors from url for an authorless work', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'jvining')
      // Manually add username to author so URL inference can match
      await agent.put(`/api/auth/${author._id}`).send({ usernames: ['jvining'] }).expect(200)
      const work = await createWork(agent, { name: 'AuthorlessWork' })
      await agent.put(`/api/work/${work._id}`).send({ url: 'https://jvining.substack.com/post/x' }).expect(200)
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.authors?.[0]?._id).toBe(String(author._id))
    })

    it('infers year from url when not provided', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'NoYear' })
      await agent.put(`/api/work/${work._id}`).send({ url: 'https://example.com/2019/03/post' }).expect(200)
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.year).toBe(2019)
    })
  })

  describe('DELETE /api/work/:id', () => {
    it('deletes the work', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'Doomed' })
      await agent.delete(`/api/work/${work._id}`).expect(204)
      await agent.get(`/api/work/${work._id}`).expect(400)
    })
  })

  describe('PUT /api/work/:id/auth/create', () => {
    it('creates an author and appends to the work authors', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'WorkX' })
      await agent.put(`/api/work/${work._id}/auth/create`).send({ name: 'NewAuthor' }).expect(201)
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.authors?.[0]?.name).toBe('NewAuthor')
    })
  })

  describe('PUT /api/work/:id/pile (add existing pile)', () => {
    it('adds a pile to the work', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'WorkP' })
      const pile = await createPile(agent, 'p1')
      await agent.put(`/api/work/${work._id}/pile`).send({ id: pile._id }).expect(200)
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.piles.map(p => String(p._id))).toContain(String(pile._id))
    })
  })

  describe('PUT /api/work/:id/pile/create (create + add pile)', () => {
    it('creates a new pile and adds to the work', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'WorkP' })
      await agent.put(`/api/work/${work._id}/pile/create`).send({ name: 'newPile' }).expect(201)
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.piles.some(p => p.name === 'newPile')).toBe(true)
    })
  })

  describe('DELETE /api/work/:id/pile/:pileId', () => {
    it('removes a pile from the work', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'WorkP' })
      const pile = await createPile(agent, 'p1')
      await agent.put(`/api/work/${work._id}/pile`).send({ id: pile._id }).expect(200)
      await agent.delete(`/api/work/${work._id}/pile/${pile._id}`).expect(200)
      const res = await agent.get(`/api/work/${work._id}`).expect(200)
      expect(res.body.data.piles.map(p => String(p._id))).not.toContain(String(pile._id))
    })
  })

  describe('POST /api/work/autocomplete', () => {
    it('finds works by substring', async () => {
      const agent = await authedAgent()
      await createWork(agent, { name: 'Republic' })
      await createWork(agent, { name: 'Symposium' })
      const res = await agent.post('/api/work/autocomplete').send({ string: 'Rep' }).expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].name).toBe('Republic')
    })
  })

  describe('POST /api/work/autocomplete/with-counts', () => {
    it('returns works with note_count', async () => {
      const agent = await authedAgent()
      await createWork(agent, { name: 'Republic' })
      const res = await agent.post('/api/work/autocomplete/with-counts').send({ string: 'Rep' }).expect(200)
      expect(res.body.data[0].note_count).toBe(0)
    })
  })

  describe('GET /api/work/:id/notes', () => {
    it('returns notes attached to the work', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'NotedWork' })
      await createNote(agent, { work: work._id, title: 'First' })
      const res = await agent.get(`/api/work/${work._id}/notes`).expect(200)
      expect(res.body.data.length).toBeGreaterThan(0)
    })

    it('returns empty array for work with no notes', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'EmptyWork' })
      const res = await agent.get(`/api/work/${work._id}/notes`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })
})
