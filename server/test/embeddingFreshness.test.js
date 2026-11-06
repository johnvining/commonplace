import { describe, expect, it, vi, beforeEach } from 'vitest'
import { authedAgent, createIdea, createNote, createWork } from './setup.js'

// Fake embeddings: the vector encodes how many times a note was embedded
const embedCalls = []
let embedImpl = async (note) => ({ embedding: [embedCalls.length, 1], embeddingHash: 'h' + embedCalls.length })
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    embedNoteIfStale: vi.fn(async (note) => {
      embedCalls.push(String(note._id))
      return embedImpl(note)
    }),
  }
})

const Note = async () => (await import('../src/resources/note/note.model.js')).default
const stale = async (id) => (await (await Note()).findById(id).lean()).embeddingStale

beforeEach(() => {
  embedCalls.length = 0
  embedImpl = async () => ({ embedding: [embedCalls.length, 1], embeddingHash: 'h' + embedCalls.length })
})

describe('embedding freshness (#373)', () => {
  it('marks a note stale on any write to an embedding input, however it is made', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N' })
    expect(await stale(note._id)).toBe(true)
    const { saveEmbedding } = await import('../src/utils/embeddingRefresh.js')
    await saveEmbedding(note._id, { embedding: [1], embeddingHash: 'x' })
    expect(await stale(note._id)).toBe(false)

    await agent.put(`/api/note/${note._id}`).send({ text: 'changed' }).expect(200)
    expect(await stale(note._id)).toBe(true)

    await saveEmbedding(note._id, { embedding: [1], embeddingHash: 'x' })
    const idea = await createIdea(agent)
    await agent.post('/api/note/bulk-update').send({ ids: [note._id], ideas: [idea._id] }).expect(200)
    expect(await stale(note._id)).toBe(true)

    // Fields outside the embedding leave it alone
    await saveEmbedding(note._id, { embedding: [1], embeddingHash: 'x' })
    await (await Note()).updateOne({ _id: note._id }, { $set: { page: '12' } })
    expect(await stale(note._id)).toBe(false)
  })

  it("marks a work's notes stale when the work is renamed", async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Old name' })
    const note = await createNote(agent, { title: 'N', work: work._id })
    const { saveEmbedding } = await import('../src/utils/embeddingRefresh.js')
    await saveEmbedding(note._id, { embedding: [1], embeddingHash: 'x' })
    await agent.put(`/api/work/${work._id}`).send({ name: 'New name' }).expect(200)
    // The rename hook runs after the update returns
    await vi.waitFor(async () => expect(await stale(note._id)).toBe(true))
  })

  it('re-embeds stale notes into Mongo and the search cache, leaving updatedAt alone', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N', text: 'hello' })
    const before = (await (await Note()).findById(note._id).lean()).updatedAt
    const { refreshStaleEmbeddings } = await import('../src/utils/embeddingRefresh.js')
    const { getEmbeddingCache } = await import('../src/utils/embeddingCache.js')
    const cache = await getEmbeddingCache()
    const result = await refreshStaleEmbeddings()
    expect(result.embedded).toBeGreaterThanOrEqual(1)
    const saved = await (await Note()).findById(note._id).lean()
    expect(saved.embeddingStale).toBe(false)
    expect(saved.embedding).toEqual(cache.get(String(note._id)))
    expect(saved.updatedAt.getTime()).toBe(before.getTime())
  })

  it('leaves a note stale when it is edited while being embedded', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N', text: 'hello' })
    embedImpl = async (n) => {
      if (String(n._id) === String(note._id)) {
        await new Promise((r) => setTimeout(r, 5))
        await agent.put(`/api/note/${note._id}`).send({ text: 'edited meanwhile' }).expect(200)
      }
      return { embedding: [9], embeddingHash: 'old' }
    }
    const { refreshStaleEmbeddings } = await import('../src/utils/embeddingRefresh.js')
    await refreshStaleEmbeddings()
    const saved = await (await Note()).findById(note._id).lean()
    expect(saved.embeddingStale).toBe(true)
    expect(saved.embeddingHash).not.toBe('old')
  })

  it('tries a failing note once per pass instead of spinning', async () => {
    const agent = await authedAgent()
    await createNote(agent, { title: 'N', text: 'hello' })
    embedImpl = async () => { throw new Error('OpenAI down') }
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { refreshStaleEmbeddings } = await import('../src/utils/embeddingRefresh.js')
    const result = await refreshStaleEmbeddings()
    quiet.mockRestore()
    expect(result.failed).toBe(embedCalls.length)
    expect(new Set(embedCalls).size).toBe(embedCalls.length)
  })

  it('reloads the search cache once it is old, to pick up other processes', async () => {
    const { getEmbeddingCache } = await import('../src/utils/embeddingCache.js')
    await getEmbeddingCache()
    const { insertedId } = await (await Note()).collection.insertOne({ title: 'From the CLI', embedding: [0.5, 0.5] })
    const realNow = Date.now
    vi.spyOn(Date, 'now').mockImplementation(() => realNow() + 11 * 60 * 1000)
    try {
      await getEmbeddingCache()
      await vi.waitFor(async () => expect((await getEmbeddingCache()).has(String(insertedId))).toBe(true))
    } finally {
      vi.restoreAllMocks()
    }
  })
})
