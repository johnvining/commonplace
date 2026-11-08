import { describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'
import Nick from '../src/resources/nick/nick.model.js'
import { mintNick as generateNick } from '../src/resources/nick/nickLifecycle.js'
import { authedAgent, createIdea, createNote, createPile, createWork } from './setup.js'

async function ensureNickFor(agent, type, id) {
  const res = await agent.put(`/api/nick/${type}/${id}`).expect(200)
  return res.body.data
}

describe('nick', () => {
  describe('PUT /api/nick/:type/:id (generate)', () => {
    it.each([
      ['note', 'n'],
      ['work', 'w'],
      ['idea', 'i'],
      ['pile', 'p'],
    ])('generates a nick for %s with prefix %s', async (type, prefix) => {
      const agent = await authedAgent()
      let entity
      if (type === 'note') entity = await createNote(agent, { title: 'X' })
      else if (type === 'work') entity = await createWork(agent)
      else if (type === 'idea') entity = await createIdea(agent)
      else if (type === 'pile') entity = await createPile(agent)
      const nick = await ensureNickFor(agent, type, entity._id)
      expect(nick.key).toMatch(new RegExp(`^${prefix}\\d{6}$`))
      expect(String(nick[type])).toBe(String(entity._id))
    })

    it('returns existing nick on second call (idempotent)', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const a = await ensureNickFor(agent, 'note', note._id)
      const b = await ensureNickFor(agent, 'note', note._id)
      expect(a.key).toBe(b.key)
    })
  })

  describe('generateNick', () => {
    it('retries when another entity takes the key first (#347)', async () => {
      await Nick.init()
      const { default: Work } = await import('../src/resources/work/work.model.js')
      // Straight to the collection, so no nick is minted on create
      const id = (await Work.collection.insertOne({ name: 'W' })).insertedId
      const otherId = new mongoose.Types.ObjectId()
      const realCreate = Nick.create.bind(Nick)
      const spy = vi.spyOn(Nick, 'create').mockImplementationOnce(async (doc) => {
        // Another work claims the same key between the check and the create
        await realCreate({ key: doc.key, work: otherId })
        return realCreate(doc)
      })
      try {
        const nick = await generateNick('work', id)
        expect(nick).not.toBeNull()
        expect(String(nick.work)).toBe(String(id))
        expect(nick.key).toMatch(/^w\d{6}$/)
      } finally {
        spy.mockRestore()
      }
    })
  })

  describe('GET /api/nick/:type/:id (lookup)', () => {
    it('returns nick for an entity that has one', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent)
      const created = await ensureNickFor(agent, 'work', work._id)
      const res = await agent.get(`/api/nick/work/${work._id}`).expect(200)
      expect(res.body.data.key).toBe(created.key)
    })

    it('returns null for an entity without a nick', async () => {
      const agent = await authedAgent()
      // Use a fresh ObjectId that we never created an entity for — guarantees no nick.
      const res = await agent.get('/api/nick/work/507f1f77bcf86cd799439011').expect(200)
      expect(res.body.data).toBeNull()
    })
  })

  describe('GET /api/nick/:nick (resolve key)', () => {
    it('returns the nick document for a known key', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent)
      const created = await ensureNickFor(agent, 'idea', idea._id)
      const res = await agent.get(`/api/nick/${created.key}`).expect(200)
      expect(res.body.data.key).toBe(created.key)
      expect(String(res.body.data.idea)).toBe(String(idea._id))
    })

    it('does not resolve or reissue the key of a deleted entity (#348)', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'Gone Work' })
      const created = await ensureNickFor(agent, 'work', work._id)
      await agent.delete(`/api/work/${work._id}`).expect(204)
      const res = await agent.get(`/api/nick/${created.key}`).expect(200)
      // No entity id, but it says what it was (#366)
      expect(res.body.data).toMatchObject({ key: created.key, retired: true, name: 'Gone Work' })
      expect(res.body.data.work).toBeUndefined()
      // The row stays, so the key-uniqueness checks treat it as taken
      const row = await Nick.findOne({ key: created.key }).lean()
      expect(row.retired).toBe(true)
      expect(row.work).toBeUndefined()
      // and the deleted work gets no new nick (#384)
      expect(await generateNick('work', work._id)).toBeNull()
    })

    it('remembers the title of a deleted note (#366)', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'Only some text here' })
      const created = await ensureNickFor(agent, 'note', note._id)
      await agent.delete(`/api/note/${note._id}`).expect(200)
      const res = await agent.get(`/api/nick/${created.key}`).expect(200)
      expect(res.body.data).toMatchObject({ retired: true, name: 'Only some text here' })
      expect(res.body.data.retiredAt).toBeTruthy()
    })

    it('still deletes when the name lookup fails', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'W' })
      const created = await ensureNickFor(agent, 'work', work._id)
      // Fail only the name lookup, which asks for just name, title and text
      const realFindById = mongoose.Model.findById
      const spy = vi.spyOn(mongoose.Model, 'findById').mockImplementation(function (id, projection, ...rest) {
        if (projection && 'title' in projection) throw new Error('boom')
        return realFindById.call(this, id, projection, ...rest)
      })
      try {
        await agent.delete(`/api/work/${work._id}`).expect(204)
      } finally {
        spy.mockRestore()
      }
      const res = await agent.get(`/api/nick/${created.key}`).expect(200)
      expect(res.body.data).toMatchObject({ retired: true, name: null })
    })

    it('returns null for an unknown key', async () => {
      const agent = await authedAgent()
      const res = await agent.get('/api/nick/x000000').expect(200)
      expect(res.body.data).toBeNull()
    })
  })

  describe('POST /api/nick/backfill', () => {
    it('creates nicks for entities that lack them', async () => {
      const agent = await authedAgent()
      // New notes get nicks when created (#367), so make legacy ones directly
      await Nick.db.collection('notes').insertMany([{ title: 'A' }, { title: 'B' }])
      const res = await agent.post('/api/nick/backfill').expect(200)
      expect(res.body.data.note).toBeDefined()
      expect(res.body.data.note.total).toBeGreaterThanOrEqual(2)
      expect(res.body.data.note.created).toBeGreaterThanOrEqual(2)
    })
  })

  it('mints no nick for a record that does not exist (#384)', async () => {
    const agent = await authedAgent()
    const missing = new mongoose.Types.ObjectId()
    const res = await agent.put(`/api/nick/work/${missing}`).expect(200)
    expect(res.body.data).toBeNull()
    expect(await Nick.countDocuments({ work: missing })).toBe(0)
    await agent.put('/api/nick/idea/not-an-id').expect(400)
  })

  describe('author nicks (#382)', () => {
    it('mints one for a new author, and resolves it', async () => {
      const agent = await authedAgent()
      const author = (await agent.post('/api/auth/').send({ name: 'Seneca' }).expect(201)).body.data
      const row = await Nick.findOne({ auth: author._id }).lean()
      expect(row.key).toMatch(/^a\d{6}$/)
      const res = await agent.get(`/api/nick/${row.key}`).expect(200)
      expect(res.body.data).toMatchObject({ state: 'active', auth: String(author._id) })
      expect((await agent.get(`/api/nick/auth/${author._id}`).expect(200)).body.data.key).toBe(row.key)
    })

    it('retires it with the author, keeping the name', async () => {
      const agent = await authedAgent()
      const author = (await agent.post('/api/auth/').send({ name: 'Gone' }).expect(201)).body.data
      const { key } = await Nick.findOne({ auth: author._id }).lean()
      await agent.delete(`/api/auth/${author._id}`).expect(204)
      expect((await agent.get(`/api/nick/${key}`).expect(200)).body.data).toMatchObject({ state: 'retired', name: 'Gone' })
      expect((await agent.get(`/api/nick/former/auth/${author._id}`).expect(200)).body.data).toMatchObject({ name: 'Gone' })
    })

    it('leads a merged author to the kept one', async () => {
      const agent = await authedAgent()
      const from = (await agent.post('/api/auth/').send({ name: 'Old' }).expect(201)).body.data
      const into = (await agent.post('/api/auth/').send({ name: 'Kept' }).expect(201)).body.data
      const { key } = await Nick.findOne({ auth: from._id }).lean()
      await agent.post(`/api/auth/${from._id}/merge`).send({ into: into._id }).expect(200)
      expect((await agent.get(`/api/nick/${key}`).expect(200)).body.data).toMatchObject({ state: 'alias', auth: String(into._id) })
    })
  })

  describe('GET /api/nick/former/:type/:id (#384)', () => {
    it('leads a merged work to the kept one, and names a deleted record', async () => {
      const agent = await authedAgent()
      const from = await createWork(agent, { name: 'Old' })
      const into = await createWork(agent, { name: 'Kept' })
      await agent.post(`/api/work/${from._id}/merge`).send({ into: into._id }).expect(200)
      const merged = (await agent.get(`/api/nick/former/work/${from._id}`).expect(200)).body.data
      expect(merged).toMatchObject({ state: 'alias', work: String(into._id), mergedFrom: 'Old' })

      const idea = await createIdea(agent, 'Gone idea')
      await agent.delete(`/api/idea/${idea._id}`).expect(204)
      const deleted = (await agent.get(`/api/nick/former/idea/${idea._id}`).expect(200)).body.data
      expect(deleted).toMatchObject({ state: 'retired', name: 'Gone idea' })
    })

    it('knows nothing of an id that never had a nick, or the wrong type', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent, 'I')
      await agent.delete(`/api/idea/${idea._id}`).expect(204)
      expect((await agent.get(`/api/nick/former/work/${idea._id}`).expect(200)).body.data).toBeNull()
      expect((await agent.get(`/api/nick/former/work/${new mongoose.Types.ObjectId()}`).expect(200)).body.data).toBeNull()
      await agent.get('/api/nick/former/link/507f1f77bcf86cd799439011').expect(400)
    })
  })
})
