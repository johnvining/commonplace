import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createAuthor, createIdea, createPile, createWork } from './setup.js'

// Unified search embeds the query; keep that off OpenAI.
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, generateEmbedding: vi.fn().mockResolvedValue(Array(8).fill(0)) }
})

const names = async (agent, type, string) =>
  (await agent.post(`/api/${type}/autocomplete`).send({ string }).expect(200)).body.data.map((d) => d.name).sort()

describe('name search matches the start of words', () => {
  it('authors: "all" no longer finds Donald Hall; "don ha" does', async () => {
    const agent = await authedAgent()
    for (const n of ['Donald Hall', 'Allen Ginsberg', 'Woody Allen', 'Don Paterson']) await createAuthor(agent, n)
    expect(await names(agent, 'auth', 'all')).toEqual(['Allen Ginsberg', 'Woody Allen'])
    expect(await names(agent, 'auth', 'don ha')).toEqual(['Donald Hall'])
    expect(await names(agent, 'auth', 'ha don')).toEqual(['Donald Hall'])
    expect(await names(agent, 'auth', 'don')).toEqual(['Don Paterson', 'Donald Hall'])
  })

  it('works, ideas and piles: words after punctuation count, mid-word matches do not', async () => {
    const agent = await authedAgent()
    await createWork(agent, { name: 'The Fall of Rome' })
    await createWork(agent, { name: 'Football' })
    await createIdea(agent, 'Self-reliance')
    await createIdea(agent, 'Reliability')
    await createPile(agent, 'Status: Reading')
    await createPile(agent, 'Proofreading')
    expect(await names(agent, 'work', 'fall')).toEqual(['The Fall of Rome'])
    expect(await names(agent, 'idea', 'reli')).toEqual(['Reliability', 'Self-reliance'])
    expect(await names(agent, 'pile', 'reading')).toEqual(['Status: Reading'])
  })

  it('unified search uses the same rule for names', async () => {
    const agent = await authedAgent()
    for (const n of ['Donald Hall', 'Woody Allen']) await createAuthor(agent, n)
    const res = await agent.post('/api/note/unified-search').send({ query: 'all' }).expect(200)
    expect(res.body.data.filter((r) => r.type === 'auth').map((r) => r.item.name)).toEqual(['Woody Allen'])
  })
})
