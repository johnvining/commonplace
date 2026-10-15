import { beforeAll, describe, expect, it, vi } from 'vitest'
import { authedAgent, createNote } from './setup.js'

vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    generateEmbedding: vi.fn().mockResolvedValue(Array(8).fill(0)),
    embedNoteIfStale: vi.fn().mockResolvedValue(null),
  }
})

beforeAll(async () => {
  const Note = (await import('../src/resources/note/note.model.js')).default
  await Note.init() // the $text index
})

const find = async (agent, searchString) =>
  (await agent.put('/api/note/find').send({ searchString }).expect(200)).body.data.map((n) => n.title)
const unified = async (agent, query) =>
  (await agent.post('/api/note/unified-search').send({ query }).expect(200)).body.data
    .filter((r) => r.type === 'note').map((r) => r.item.title)

// Neutral titles: titles are indexed too, and would skew the ranking.
async function seed(agent) {
  for (const [title, text] of [
    ['n1', 'It was not at all clear what he meant.'],
    ['n2', 'The fall of Rome took centuries.'],
    ['n3', 'Rome and Carthage fought three wars.'],
    ['n4', 'Carthage was rebuilt by Caesar.'],
    ['n5', 'Nothing relevant here.'],
  ]) await createNote(agent, { title, text })
}

describe('note keyword search', () => {
  it('finds a phrase made only of stop words', async () => {
    const agent = await authedAgent()
    await seed(agent)
    expect(await find(agent, 'not at all')).toEqual(['n1'])
    expect(await unified(agent, 'not at all')).toContain('n1')
  })

  it('matches any word, ranking notes with more of them first', async () => {
    const agent = await authedAgent()
    await seed(agent)
    const titles = await find(agent, 'rome carthage')
    expect(titles[0]).toBe('n3')
    expect(titles.slice().sort()).toEqual(['n2', 'n3', 'n4'])
  })

  it('treats a quoted phrase as exact', async () => {
    const agent = await authedAgent()
    await seed(agent)
    expect(await find(agent, '"fall of Rome"')).toEqual(['n2'])
    expect(await find(agent, '"Rome fall"')).toEqual([])
  })

  it('ranks an exact phrase above notes that only share words', async () => {
    const agent = await authedAgent()
    await seed(agent)
    await createNote(agent, { title: 'n6', text: 'Rome. Later, a fall. Carthage, of course.' })
    expect((await find(agent, 'fall of Rome'))[0]).toBe('n2')
  })
})
