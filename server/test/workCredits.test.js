import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createWork } from './setup.js'

const ids = (list) => list.map(x => x._id ?? x)

describe('work editors and translators (#358)', () => {
  it('stores them apart from the authors and populates them', async () => {
    const agent = await authedAgent()
    const author = await createAuthor(agent, 'Author')
    const editor = await createAuthor(agent, 'Editor')
    const translator = await createAuthor(agent, 'Translator')
    const work = await createWork(agent, { name: 'W', authors: [author._id] })
    await agent.put(`/api/work/${work._id}`)
      .send({ editors: [editor._id], translators: [translator._id] })
      .expect(200)
    const info = (await agent.get(`/api/work/${work._id}`).expect(200)).body.data
    expect(ids(info.authors)).toEqual([author._id])
    expect(info.editors.map(e => e.name)).toEqual(['Editor'])
    expect(info.translators.map(t => t.name)).toEqual(['Translator'])
  })

  it('lists what an author edited and translated, not under their works', async () => {
    const agent = await authedAgent()
    const person = await createAuthor(agent, 'Person')
    const edited = await createWork(agent, { name: 'Edited' })
    const translated = await createWork(agent, { name: 'Translated' })
    await agent.put(`/api/work/${edited._id}`).send({ editors: [person._id] }).expect(200)
    await agent.put(`/api/work/${translated._id}`).send({ translators: [person._id] }).expect(200)
    const credits = (await agent.get(`/api/auth/${person._id}/credits`).expect(200)).body.data
    expect(credits.edited.map(w => w.name)).toEqual(['Edited'])
    expect(credits.translated.map(w => w.name)).toEqual(['Translated'])
    const works = (await agent.get(`/api/auth/${person._id}/works`).expect(200)).body.data
    expect(works).toEqual([])
  })

  it('drops a deleted author from editors and translators', async () => {
    const agent = await authedAgent()
    const person = await createAuthor(agent, 'Person')
    const work = await createWork(agent, { name: 'W' })
    await agent.put(`/api/work/${work._id}`).send({ editors: [person._id], translators: [person._id] }).expect(200)
    await agent.delete(`/api/auth/${person._id}`).expect(204)
    const info = (await agent.get(`/api/work/${work._id}`).expect(200)).body.data
    expect(info.editors).toEqual([])
    expect(info.translators).toEqual([])
  })

  it('carries editors and translators through merges', async () => {
    const agent = await authedAgent()
    const keepAuth = await createAuthor(agent, 'Keep')
    const dropAuth = await createAuthor(agent, 'Drop')
    const keep = await createWork(agent, { name: 'Keep' })
    const drop = await createWork(agent, { name: 'Drop' })
    await agent.put(`/api/work/${drop._id}`).send({ editors: [dropAuth._id], translators: [keepAuth._id] }).expect(200)

    const workPlan = (await agent.post(`/api/work/${drop._id}/merge`).send({ into: keep._id }).expect(200)).body.data
    expect(workPlan).toMatchObject({ editors: 1, translators: 1 })

    const authPlan = (await agent.post(`/api/auth/${dropAuth._id}/merge`).send({ into: keepAuth._id }).expect(200)).body.data
    expect(authPlan).toMatchObject({ edited: 1, translated: 0 })
    const info = (await agent.get(`/api/work/${keep._id}`).expect(200)).body.data
    expect(ids(info.editors)).toEqual([keepAuth._id])
    expect(ids(info.translators)).toEqual([keepAuth._id])
  })
})
