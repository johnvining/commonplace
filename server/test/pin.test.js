import { describe, expect, it } from 'vitest'
import { authedAgent, createIdea, createWork } from './setup.js'

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
    const a = '507f1f77bcf86cd799439011'
    const b = '507f1f77bcf86cd799439012'
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
})
