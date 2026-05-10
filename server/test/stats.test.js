import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createIdea, createNote, createPile, createWork } from './setup.js'

describe('stats', () => {
  describe('GET /api/stats/', () => {
    it('returns counts for all entity types', async () => {
      const agent = await authedAgent()
      await createNote(agent, { title: 'A' })
      await createAuthor(agent, 'A')
      await createIdea(agent, 'I')
      await createWork(agent, { name: 'W' })
      await createPile(agent, 'P')

      const res = await agent.get('/api/stats/').expect(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toMatchObject({
        notes: 1,
        authors: 1,
        ideas: 1,
        works: 1,
        piles: 1,
      })
    })

    it('returns zeros for empty DB', async () => {
      const agent = await authedAgent()
      const res = await agent.get('/api/stats/').expect(200)
      expect(res.body.data).toMatchObject({ notes: 0, authors: 0, ideas: 0, works: 0, piles: 0 })
    })
  })

  describe('GET /api/stats/recent/:type', () => {
    it.each(['notes', 'authors', 'works', 'ideas', 'piles'])(
      'returns recent %s',
      async (type) => {
        const agent = await authedAgent()
        // Seed one of each so all type queries have data
        await createNote(agent, { title: 'A' })
        await createAuthor(agent, 'A')
        await createIdea(agent, 'I')
        await createWork(agent, { name: 'W' })
        await createPile(agent, 'P')

        const res = await agent.get(`/api/stats/recent/${type}`).expect(200)
        expect(res.body.success).toBe(true)
        expect(Array.isArray(res.body.data)).toBe(true)
        expect(res.body.data.length).toBeGreaterThan(0)
      }
    )

    it('returns 400 for unknown type', async () => {
      const agent = await authedAgent()
      const res = await agent.get('/api/stats/recent/widgets').expect(400)
      expect(res.body.success).toBe(false)
    })
  })
})
