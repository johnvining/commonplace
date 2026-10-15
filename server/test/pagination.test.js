import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createIdea, createPile, createWork } from './setup.js'
import Note from '../src/resources/note/note.model.js'

const COUNT = 1203

// Bulk-insert notes that all share one updatedAt, as an import does, so
// paging must rely on the _id tiebreaker to stay stable.
async function seedNotes(fields) {
  const at = new Date('2026-01-01T00:00:00Z')
  const docs = Array.from({ length: COUNT }, (_, i) => ({
    title: `n${i}`,
    ...fields,
    createdAt: at,
    updatedAt: at,
  }))
  const inserted = await Note.insertMany(docs, { timestamps: false })
  return inserted.map(n => String(n._id))
}

async function pageThrough(agent, url, pageSize = 500) {
  const seen = []
  let total
  for (let skip = 0; ; skip += pageSize) {
    const res = await agent.get(`${url}?skip=${skip}&limit=${pageSize}`).expect(200)
    total = Number(res.headers['x-total-count'])
    const ids = res.body.data.map(n => String(n._id))
    seen.push(...ids)
    if (ids.length < pageSize) break
  }
  return { seen, total }
}

describe('entity-notes paging', () => {
  it('reports the full count and pages through every note for each entity', async () => {
    const agent = await authedAgent()
    const author = await createAuthor(agent, 'Prolific')
    const idea = await createIdea(agent, 'big idea')
    const pile = await createPile(agent, 'big pile')
    const work = await createWork(agent, { name: 'Long Work' })

    const cases = [
      [`/api/auth/${author._id}/notes`, { authors: [author._id] }],
      [`/api/idea/${idea._id}/notes`, { ideas: [idea._id] }],
      [`/api/pile/${pile._id}/notes`, { piles: [pile._id] }],
      [`/api/work/${work._id}/notes`, { work: work._id }],
    ]
    for (const [url, fields] of cases) {
      const expected = await seedNotes(fields)
      const { seen, total } = await pageThrough(agent, url)
      expect(total, url).toBe(COUNT)
      expect(seen.length, url).toBe(COUNT)
      expect(new Set(seen).size, url).toBe(COUNT)
      expect(new Set(seen), url).toEqual(new Set(expected))
    }
  })

  it('pages the author all-notes view, including notes on their works', async () => {
    const agent = await authedAgent()
    const author = await createAuthor(agent, 'Prolific')
    const work = await createWork(agent, { name: 'Their Work', authors: [author._id] })
    const direct = await seedNotes({ authors: [author._id] })
    const viaWork = await seedNotes({ work: work._id })

    const { seen, total } = await pageThrough(agent, `/api/auth/${author._id}/all-notes`)
    expect(total).toBe(COUNT * 2)
    expect(new Set(seen)).toEqual(new Set([...direct, ...viaWork]))
    expect(seen.length).toBe(COUNT * 2)
  })

  it('still caps a single request at 500', async () => {
    const agent = await authedAgent()
    const pile = await createPile(agent, 'big pile')
    await seedNotes({ piles: [pile._id] })
    const res = await agent.get(`/api/pile/${pile._id}/notes?limit=100000`).expect(200)
    expect(res.body.data.length).toBe(500)
    expect(res.headers['x-total-count']).toBe(String(COUNT))
  })

  it('keeps work notes in the order they were added', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Ordered' })
    const expected = await seedNotes({ work: work._id })
    const { seen } = await pageThrough(agent, `/api/work/${work._id}/notes`)
    expect(seen).toEqual(expected)
  })

  it('reverses the whole order across pages with ?reverse=1', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Ordered' })
    const expected = await seedNotes({ work: work._id })
    const seen = []
    for (let skip = 0; skip < COUNT; skip += 500) {
      const res = await agent.get(`/api/work/${work._id}/notes?reverse=1&skip=${skip}&limit=500`).expect(200)
      seen.push(...res.body.data.map(n => String(n._id)))
    }
    expect(seen).toEqual([...expected].reverse())
  })
})
