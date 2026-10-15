import { describe, expect, it } from 'vitest'
import { authedAgent, createIdea, createNote, createPile } from './setup.js'

describe('GET /api/note/filter (AND across piles and ideas)', () => {
  it('returns only notes that have every listed pile and idea', async () => {
    const agent = await authedAgent()
    const [p1, p2] = [await createPile(agent, 'Reading'), await createPile(agent, 'Philosophy')]
    const i1 = await createIdea(agent, 'Virtue')
    const make = async (title, piles, ideas) => {
      const n = await createNote(agent, { title })
      await agent.put(`/api/note/${n._id}`).send({ piles, ideas }).expect(200)
    }
    await make('both piles + idea', [p1._id, p2._id], [i1._id])
    await make('both piles', [p1._id, p2._id], [])
    await make('one pile + idea', [p1._id], [i1._id])
    await make('neither', [], [])

    const titles = async (qs) => {
      const res = await agent.get(`/api/note/filter?${qs}`).expect(200)
      return { titles: res.body.data.map((n) => n.title).sort(), total: res.headers['x-total-count'] }
    }
    expect(await titles(`piles=${p1._id},${p2._id}`)).toEqual({ titles: ['both piles', 'both piles + idea'], total: '2' })
    expect(await titles(`piles=${p1._id}&ideas=${i1._id}`)).toEqual({ titles: ['both piles + idea', 'one pile + idea'], total: '2' })
    expect(await titles(`piles=${p1._id},${p2._id}&ideas=${i1._id}`)).toEqual({ titles: ['both piles + idea'], total: '1' })
    expect((await titles(`piles=${p1._id}&skip=0&limit=1`)).titles).toHaveLength(1)
  })

  it('rejects an empty filter and bad ids', async () => {
    const agent = await authedAgent()
    await agent.get('/api/note/filter').expect(400)
    await agent.get('/api/note/filter?piles=nope').expect(400)
  })
})
