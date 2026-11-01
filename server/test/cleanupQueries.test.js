import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createNote, createWork } from './setup.js'
import { nameKey } from '../src/utils/cleanupQueries.js'

describe('cleanup queries (#357)', () => {
  it('nameKey ignores case, accents, punctuation and spacing', () => {
    expect(nameKey('race ? »,par')).toBe(nameKey('race ? », par'))
    expect(nameKey('Émile Zola')).toBe(nameKey('emile zola'))
    expect(nameKey('A')).not.toBe(nameKey('B'))
  })

  it('groups notes by title, counting unlinked ones', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'W' })
    await createNote(agent, { title: 'Article' })
    await createNote(agent, { title: ' article ' })
    await createNote(agent, { title: 'Article', work: work._id })
    await createNote(agent, { title: 'Single' })
    const groups = (await agent.get('/api/note/title-groups?min=2').expect(200)).body.data
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ title: 'Article', count: 3, unlinked: 2 })
    expect(groups[0].ids).toHaveLength(3)
  })

  it('lists notes with no work', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'W' })
    await createNote(agent, { title: 'Loose' })
    await createNote(agent, { title: 'Linked', work: work._id })
    const res = await agent.get('/api/note/no-work').expect(200)
    expect(res.body.data.map(n => n.title)).toEqual(['Loose'])
    expect(res.headers['x-total-count']).toBe('1')
  })

  it('finds notes titled like a work but not linked to it', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Bowling Alone' })
    const other = await createWork(agent, { name: 'Other' })
    await createNote(agent, { title: 'bowling alone' })
    await createNote(agent, { title: 'Bowling Alone', work: other._id })
    await createNote(agent, { title: 'Bowling Alone', work: work._id })
    const rows = (await agent.get('/api/note/titled-like-work').expect(200)).body.data
    expect(rows).toHaveLength(1)
    expect(rows[0].work._id).toBe(work._id)
    expect(rows[0].notes).toHaveLength(2)
  })

  it('lists works with no notes', async () => {
    const agent = await authedAgent()
    const used = await createWork(agent, { name: 'Used' })
    await createWork(agent, { name: 'Empty' })
    await createNote(agent, { title: 'N', work: used._id })
    const works = (await agent.get('/api/work/no-notes').expect(200)).body.data
    expect(works.map(w => w.name)).toEqual(['Empty'])
  })

  it('groups near-duplicate works and authors', async () => {
    const agent = await authedAgent()
    await createWork(agent, { name: 'race ? »,par' })
    await createWork(agent, { name: 'race ? », par' })
    await createWork(agent, { name: 'Unique' })
    await createAuthor(agent, 'Tyler Cowen')
    await createAuthor(agent, 'tyler  cowen.')
    const works = (await agent.get('/api/work/duplicates').expect(200)).body.data
    expect(works).toHaveLength(1)
    expect(works[0]).toHaveLength(2)
    const authors = (await agent.get('/api/auth/duplicates').expect(200)).body.data
    expect(authors.map(g => g.map(a => a.name).sort())).toEqual([['Tyler Cowen', 'tyler  cowen.']])
  })

  it('lists authors that look like several people', async () => {
    const agent = await authedAgent()
    await createAuthor(agent, 'Dierdre McCloskey,Stephen T. Ziliak')
    await createAuthor(agent, 'Smith & Jones')
    await createAuthor(agent, 'Alexandra Anderson')
    const names = (await agent.get('/api/auth/combined').expect(200)).body.data.map(a => a.name)
    expect(names).toEqual(['Dierdre McCloskey,Stephen T. Ziliak', 'Smith & Jones'])
  })
})
