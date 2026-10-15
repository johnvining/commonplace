import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createIdea, createPile, createWork } from './setup.js'

const getWork = async (agent, id) => (await agent.get(`/api/work/${id}`).expect(200)).body.data
const ideaNames = (work) => (work.ideas ?? []).map(i => i.name).sort()

describe('ideas on works', () => {
  it('adds an existing idea once, and shows it populated on the work', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Meditations' })
    const idea = await createIdea(agent, 'Stoicism')
    await agent.put(`/api/work/${work._id}/idea`).send({ id: idea._id }).expect(200)
    await agent.put(`/api/work/${work._id}/idea`).send({ id: idea._id }).expect(200)
    expect(ideaNames(await getWork(agent, work._id))).toEqual(['Stoicism'])
  })

  it('creates a new idea and adds it', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Meditations' })
    await agent.put(`/api/work/${work._id}/idea/create`).send({ name: 'Virtue' }).expect(201)
    expect(ideaNames(await getWork(agent, work._id))).toEqual(['Virtue'])
    await agent.put(`/api/work/${work._id}/idea/create`).send({ name: '  ' }).expect(400)
  })

  it('removes an idea', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Meditations' })
    const a = await createIdea(agent, 'Stoicism')
    const b = await createIdea(agent, 'Virtue')
    await agent.put(`/api/work/${work._id}`).send({ ideas: [a._id, b._id] }).expect(200)
    await agent.delete(`/api/work/${work._id}/idea/${a._id}`).expect(200)
    expect(ideaNames(await getWork(agent, work._id))).toEqual(['Virtue'])
  })

  it("lists an idea's works", async () => {
    const agent = await authedAgent()
    const idea = await createIdea(agent, 'Stoicism')
    const w1 = await createWork(agent, { name: 'Meditations' })
    await createWork(agent, { name: 'Unrelated' })
    await agent.put(`/api/work/${w1._id}/idea`).send({ id: idea._id }).expect(200)
    const res = await agent.get(`/api/idea/${idea._id}/works`).expect(200)
    expect(res.body.data.map(w => w.name)).toEqual(['Meditations'])
  })

  it('removes a deleted idea from its works', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Meditations' })
    const doomed = await createIdea(agent, 'Doomed')
    const kept = await createIdea(agent, 'Kept')
    await agent.put(`/api/work/${work._id}`).send({ ideas: [doomed._id, kept._id] }).expect(200)
    await agent.delete(`/api/idea/${doomed._id}/delete`).expect(204)
    expect(ideaNames(await getWork(agent, work._id))).toEqual(['Kept'])
  })

  it("includes ideas in pile and author work lists", async () => {
    const agent = await authedAgent()
    const author = await createAuthor(agent, 'Marcus Aurelius')
    const pile = await createPile(agent, 'Reading')
    const work = await createWork(agent, { name: 'Meditations', authors: [author._id] })
    const idea = await createIdea(agent, 'Stoicism')
    await agent.put(`/api/work/${work._id}`).send({ piles: [pile._id], ideas: [idea._id] }).expect(200)
    const pileWorks = (await agent.get(`/api/pile/${pile._id}/works`).expect(200)).body.data
    const authorWorks = (await agent.get(`/api/auth/${author._id}/works`).expect(200)).body.data
    expect(ideaNames(pileWorks[0])).toEqual(['Stoicism'])
    expect(ideaNames(authorWorks[0])).toEqual(['Stoicism'])
  })
})
