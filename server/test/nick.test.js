import { describe, expect, it } from 'vitest'
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

    it('returns null for an unknown key', async () => {
      const agent = await authedAgent()
      const res = await agent.get('/api/nick/x000000').expect(200)
      expect(res.body.data).toBeNull()
    })
  })

  describe('POST /api/nick/backfill', () => {
    it('creates nicks for entities that lack them', async () => {
      const agent = await authedAgent()
      // Create entities with no nicks (createNote uses default createOne which skips nick gen)
      await createNote(agent, { title: 'A' })
      await createNote(agent, { title: 'B' })
      // Use createOne for work too — auth.test created via /api/work which uses reqCreateWork (does generate nick)
      // So just call backfill and confirm it returns counts.
      const res = await agent.post('/api/nick/backfill').expect(200)
      expect(res.body.data.note).toBeDefined()
      expect(res.body.data.note.total).toBeGreaterThanOrEqual(2)
      expect(res.body.data.note.created).toBeGreaterThanOrEqual(2)
    })
  })
})
