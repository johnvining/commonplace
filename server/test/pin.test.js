import { describe, expect, it } from 'vitest'
import { authedAgent, createIdea, createNote, createPile, createWork } from './setup.js'

describe('starred items (pins)', () => {
  it('stars, lists newest first, and unstars', async () => {
    const agent = await authedAgent()
    const idea = await createIdea(agent, 'Attention')
    const work = await createWork(agent, { name: 'Essays' })
    await agent.put('/api/pin/').send({ type: 'idea', id: idea._id, label: 'Attention', href: `/idea/${idea._id}` }).expect(200)
    await agent.put('/api/pin/').send({ type: 'work', id: work._id, label: 'Essays', href: `/work/${work._id}` }).expect(200)
    let list = (await agent.get('/api/pin/').expect(200)).body.data
    expect(list.map((p) => p.label)).toEqual(['Essays', 'Attention'])
    expect(list[0]).toMatchObject({ type: 'work', id: String(work._id) })

    // Starring again moves it to the top, without a duplicate.
    await agent.put('/api/pin/').send({ type: 'idea', id: idea._id, label: 'Attention' }).expect(200)
    list = (await agent.get('/api/pin/').expect(200)).body.data
    expect(list.map((p) => p.label)).toEqual(['Attention', 'Essays'])

    await agent.delete(`/api/pin/idea/${idea._id}`).expect(200)
    list = (await agent.get('/api/pin/').expect(200)).body.data
    expect(list.map((p) => p.label)).toEqual(['Essays'])
  })

  it('imports browser stars, keeping order and existing ones', async () => {
    const agent = await authedAgent()
    // Stars must name real records; ones that don't are dropped (#381)
    const a = (await createNote(agent, { title: 'A' }))._id
    const b = (await createPile(agent, 'B'))._id
    await agent.put('/api/pin/').send({ type: 'note', id: a, label: 'Kept' }).expect(200)
    const res = await agent
      .post('/api/pin/import')
      .send({ items: [
        { type: 'note', id: a, label: 'Ignored', pinnedAt: 1 },
        { type: 'pile', id: b, label: 'Imported', pinnedAt: 2 },
        { type: 'bogus', id: b },
        { type: 'note', id: 'not-an-id' },
      ] })
      .expect(200)
    expect(res.body.data.map((p) => p.label).sort()).toEqual(['Imported', 'Kept'])
  })

  it('rejects bad items and needs a login', async () => {
    const agent = await authedAgent()
    await agent.put('/api/pin/').send({ type: 'note', id: 'x' }).expect(400)
    await agent.post('/api/user/logout').expect(200)
    await agent.get('/api/pin/').expect(401)
  })

  describe('sync (#381)', () => {
    const sync = (agent, ops) => agent.post('/api/pin/sync').send({ ops }).expect(200)
    const labels = (res) => res.body.data.map((p) => p.label)

    it('applies queued stars and unstars by when they were made, last one winning', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent, 'I')
      const t = Date.now() - 10_000
      await sync(agent, [{ op: 'pin', type: 'idea', id: idea._id, label: 'I', at: t }])
      // An unstar made later on a phone, synced first
      await sync(agent, [{ op: 'unpin', type: 'idea', id: idea._id, at: t + 2000 }])
      // An older star from a laptop that was offline doesn't bring it back
      const res = await sync(agent, [{ op: 'pin', type: 'idea', id: idea._id, label: 'I', at: t + 1000 }])
      expect(labels(res)).toEqual([])
      // A newer one does
      expect(labels(await sync(agent, [{ op: 'pin', type: 'idea', id: idea._id, label: 'I', at: t + 3000 }]))).toEqual(['I'])
    })

    it('keeps an unstar of something never starred, against older stars', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'W' })
      const t = Date.now() - 10_000
      await sync(agent, [{ op: 'unpin', type: 'work', id: work._id, at: t + 1000 }])
      expect(labels(await sync(agent, [{ op: 'pin', type: 'work', id: work._id, label: 'W', at: t }]))).toEqual([])
    })

    it('drops stars whose record is gone, and caps far-future times', async () => {
      const agent = await authedAgent()
      const idea = await createIdea(agent, 'Gone')
      await sync(agent, [{ op: 'pin', type: 'idea', id: idea._id, label: 'Gone' }])
      const { default: Idea } = await import('../src/resources/idea/idea.model.js')
      await Idea.collection.deleteOne({ _id: Idea.castObject({ _id: idea._id })._id })
      expect(labels(await sync(agent, []))).toEqual([])

      const other = await createIdea(agent, 'Skewed')
      await sync(agent, [{ op: 'pin', type: 'idea', id: other._id, label: 'Skewed', at: Date.now() + 365 * 86400000 }])
      // A normal unstar a moment later still wins over the skewed clock
      expect(labels(await sync(agent, [{ op: 'unpin', type: 'idea', id: other._id, at: Date.now() + 120_000 }]))).toEqual([])
    })
  })
})

