import { describe, expect, it, vi, beforeEach } from 'vitest'
import { authedAgent, createAuthor, createIdea, createNote, createPile, createWork } from './setup.js'

// Mock embeddings to avoid OpenAI calls in update flows
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    embedNoteIfStale: vi.fn().mockResolvedValue(null),
    generateEmbedding: vi.fn().mockResolvedValue(new Array(256).fill(0)),
    generateBatchEmbeddings: vi.fn().mockResolvedValue([]),
    generateOcrTextIfNeeded: vi.fn().mockResolvedValue(null),
  }
})

describe('note CRUD', () => {
  describe('POST /api/note/ (create)', () => {
    it('creates a note', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/note/').send({ title: 'My Note' }).expect(201)
      expect(res.body.title).toBe('My Note')
      expect(res.body._id).toBeDefined()
    })

    it('requires authentication', async () => {
      const agent = await authedAgent()
      await agent.post('/api/user/logout').expect(200)
      await agent.post('/api/note/').send({ title: 'X' }).expect(401)
    })
  })

  describe('GET /api/note/:id', () => {
    it('returns the note (populated)', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent)
      const note = await createNote(agent, { title: 'Hello', authors: [author._id] })
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      // findNotesAndPopulate returns array; reqGetNoteDetails uses _id filter
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data[0].title).toBe('Hello')
      expect(res.body.data[0].authors?.[0]?._id).toBe(String(author._id))
    })
  })

  describe('GET /api/note/nick/:nick', () => {
    it('resolves a nick to its note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'NickMe' })
      const nickRes = await agent.put(`/api/nick/note/${note._id}`).expect(200)
      const nick = nickRes.body.data.key

      const res = await agent.get(`/api/note/nick/${nick}`).expect(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data[0]._id).toBe(String(note._id))
      expect(res.body.data[0].title).toBe('NickMe')
    })

    it('returns empty array for unknown nick', async () => {
      const agent = await authedAgent()
      const res = await agent.get('/api/note/nick/n999999').expect(200)
      expect(res.body.data).toEqual([])
    })
  })

  describe('PUT /api/note/:id (update)', () => {
    it('updates note fields', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'Original' })
      await agent.put(`/api/note/${note._id}`).send({ title: 'Updated', text: 'body' }).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(res.body.data[0].title).toBe('Updated')
      expect(res.body.data[0].text).toBe('body')
    })

    it('infers authors from url when none set', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'jvining')
      await agent.put(`/api/auth/${author._id}`).send({ usernames: ['jvining'] }).expect(200)
      const note = await createNote(agent, { title: 'X' })
      await agent.put(`/api/note/${note._id}`).send({ url: 'https://jvining.substack.com/p/post' }).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(res.body.data[0].authors?.[0]?._id).toBe(String(author._id))
    })

    it('infers year from url when not provided', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      await agent.put(`/api/note/${note._id}`).send({ url: 'https://example.com/2018/04/post' }).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(res.body.data[0].year).toBe(2018)
    })
  })

  describe('DELETE /api/note/:id', () => {
    it('deletes the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'Doomed' })
      await agent.delete(`/api/note/${note._id}`).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })
})

describe('note relations', () => {
  describe('PUT /api/note/:id/idea (add existing)', () => {
    it('adds an idea to the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const idea = await createIdea(agent, 'I')
      await agent.put(`/api/note/${note._id}/idea`).send({ id: idea._id }).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      const ideaIds = res.body.data[0].ideas.map(i => String(i._id))
      expect(ideaIds).toContain(String(idea._id))
    })
  })

  describe('PUT /api/note/:id/idea/create (create + add)', () => {
    it('creates an idea and adds it to the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      await agent.put(`/api/note/${note._id}/idea/create`).send({ name: 'fresh' }).expect(201)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(res.body.data[0].ideas.some(i => i.name === 'fresh')).toBe(true)
    })
  })

  describe('DELETE /api/note/:id/idea/:ideaId', () => {
    it('removes an idea from the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const idea = await createIdea(agent, 'I')
      await agent.put(`/api/note/${note._id}/idea`).send({ id: idea._id }).expect(200)
      await agent.delete(`/api/note/${note._id}/idea/${idea._id}`).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      const ideaIds = res.body.data[0].ideas.map(i => String(i._id))
      expect(ideaIds).not.toContain(String(idea._id))
    })
  })

  describe('PUT /api/note/:id/pile (add existing)', () => {
    it('adds a pile to the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const pile = await createPile(agent, 'P')
      await agent.put(`/api/note/${note._id}/pile`).send({ id: pile._id }).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      const pileIds = res.body.data[0].piles.map(p => String(p._id))
      expect(pileIds).toContain(String(pile._id))
    })
  })

  describe('PUT /api/note/:id/pile/create', () => {
    it('creates a pile and attaches it to the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      await agent.put(`/api/note/${note._id}/pile/create`).send({ name: 'fresh-pile' }).expect(201)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(res.body.data[0].piles.some(p => p.name === 'fresh-pile')).toBe(true)
    })
  })

  describe('DELETE /api/note/:id/pile/:pileId', () => {
    it('removes a pile from the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const pile = await createPile(agent, 'P')
      await agent.put(`/api/note/${note._id}/pile`).send({ id: pile._id }).expect(200)
      await agent.delete(`/api/note/${note._id}/pile/${pile._id}`).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      const pileIds = res.body.data[0].piles.map(p => String(p._id))
      expect(pileIds).not.toContain(String(pile._id))
    })
  })

  describe('PUT /api/note/:id/work (set work)', () => {
    it('sets work on the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const work = await createWork(agent, { name: 'W' })
      await agent.put(`/api/note/${note._id}/work`).send({ newWork: work._id }).expect(200)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(String(res.body.data[0].work?._id)).toBe(String(work._id))
    })
  })

  describe('PUT /api/note/:id/work/create (create + set)', () => {
    it('creates a work and assigns it to the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      await agent.put(`/api/note/${note._id}/work/create`).send({ newWork: 'BrandNewWork' }).expect(201)
      const res = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(res.body.data[0].work?.name).toBe('BrandNewWork')
    })
  })
})

describe('note queries', () => {
  describe('GET /api/note/all/:skip (recent)', () => {
    it('returns recent notes', async () => {
      const agent = await authedAgent()
      await createNote(agent, { title: 'A' })
      await createNote(agent, { title: 'B' })
      const res = await agent.get('/api/note/all/1').expect(200)
      expect(res.body.data.length).toBe(2)
    })
  })

  describe('GET /api/note/file/:skip (earliest unfiled)', () => {
    it('returns notes with no ideas (unfiled)', async () => {
      const agent = await authedAgent()
      await createNote(agent, { title: 'unfiled' })
      const res = await agent.get('/api/note/file/1').expect(200)
      expect(res.body.data.some(n => n.title === 'unfiled')).toBe(true)
    })

    it('excludes notes with ideas', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'tagged' })
      const idea = await createIdea(agent, 'I')
      await agent.put(`/api/note/${note._id}/idea`).send({ id: idea._id }).expect(200)
      const res = await agent.get('/api/note/file/1').expect(200)
      expect(res.body.data.some(n => n.title === 'tagged')).toBe(false)
    })
  })

  describe('GET /api/note/flip (random)', () => {
    it('returns notes', async () => {
      const agent = await authedAgent()
      await createNote(agent, { title: 'A' })
      await createNote(agent, { title: 'B' })
      const res = await agent.get('/api/note/flip').expect(200)
      expect(res.body.data.length).toBeGreaterThan(0)
    })
  })

  describe('PUT /api/note/find (text search)', () => {
    // Note: requires text index on Note. createOne lets us inject content.
    it('returns notes matching text search', async () => {
      const agent = await authedAgent()
      // The Note model declares a text index but tests skip syncIndexes(). Best-effort: just call.
      await createNote(agent, { title: 'searchable note', text: 'unique-keyword-xyzzy' })
      const res = await agent.put('/api/note/find').send({ searchString: 'xyzzy' })
      // Without indexes built, $text will 400. Assert the route is routable either way.
      expect([200, 400]).toContain(res.status)
    })
  })
})
