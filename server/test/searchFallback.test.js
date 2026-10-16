import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createNote } from './setup.js'

// OpenAI is unavailable: every query embedding fails.
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    generateEmbedding: vi.fn().mockRejectedValue(Object.assign(new Error('Incorrect API key provided'), { status: 401 })),
    embedNoteIfStale: vi.fn().mockResolvedValue(null),
  }
})

describe('search without OpenAI', () => {
  it('falls back to keyword results instead of failing', async () => {
    const agent = await authedAgent()
    await (await import('../src/resources/note/note.model.js')).default.init()
    await createNote(agent, { title: 'n1', text: 'The aqueducts of Rome' })
    await agent.post('/api/auth/').send({ name: 'Frontinus' }).expect(201)
    const res = await agent.post('/api/note/unified-search').send({ query: 'aqueducts' }).expect(200)
    expect(res.body.data.filter((r) => r.type === 'note').map((r) => r.item.title)).toEqual(['n1'])
    const byName = await agent.post('/api/note/unified-search').send({ query: 'frontinus' }).expect(200)
    expect(byName.body.data.map((r) => r.item.name)).toContain('Frontinus')
  })
})
