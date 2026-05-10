import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createNote } from './setup.js'

vi.mock('../src/utils/suggestions.js', () => ({
  getSuggestedTitle: vi.fn(async (text) => `Mocked title for "${(text || '').slice(0, 20)}"`),
  getSuggestedIdeas: vi.fn(async () => '["alpha","beta","gamma"]'),
  getOpenAiOCR: vi.fn(async (path) => `OCR(${path.split('/').pop()})`),
}))

vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    embedNoteIfStale: vi.fn(async () => null),
    generateEmbedding: vi.fn(async () => new Array(256).fill(0.5)),
    generateBatchEmbeddings: vi.fn(async (texts) =>
      texts.map(() => new Array(256).fill(0.5))
    ),
  }
})

vi.mock('../src/utils/embeddingCache.js', () => ({
  getEmbeddingCache: vi.fn(async () => new Map()),
  invalidateEmbedding: vi.fn(),
  upsertEmbedding: vi.fn(),
}))

describe('note OpenAI-backed endpoints', () => {
  describe('GET /api/note/:id/title/suggest', () => {
    it('returns a suggested title', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'Lorem ipsum' })
      const res = await agent.get(`/api/note/${note._id}/title/suggest`).expect(200)
      expect(res.body.suggested_title).toMatch(/Mocked title/)
    })
  })

  describe('GET /api/note/:id/ideas/suggest', () => {
    it('returns suggested ideas', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X', text: 'Hello' })
      const res = await agent.get(`/api/note/${note._id}/ideas/suggest`).expect(200)
      expect(res.body.suggested_ideas).toContain('alpha')
    })
  })

  describe('GET /api/note/:id/ocr', () => {
    it('runs OCR over each image and concatenates results', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X', images: ['a.jpg', 'b.jpg'] })
      const res = await agent.get(`/api/note/${note._id}/ocr`).expect(200)
      expect(res.body.data).toContain('OCR(a.jpg)')
      expect(res.body.data).toContain('OCR(b.jpg)')
    })
  })

  describe('POST /api/note/bulk-ocr', () => {
    it('runs OCR for the given note ids and writes text', async () => {
      const agent = await authedAgent()
      const n1 = await createNote(agent, { images: ['x.jpg'] })
      const n2 = await createNote(agent, { title: 'Has text already', text: 'existing' })
      const res = await agent
        .post('/api/note/bulk-ocr')
        .send({ noteIds: [n1._id, n2._id] })
        .expect(200)
      expect(res.body.data).toHaveLength(2)
      const r1 = res.body.data.find(r => String(r.noteId) === String(n1._id))
      const r2 = res.body.data.find(r => String(r.noteId) === String(n2._id))
      expect(r1.success).toBe(true)
      expect(r1.textUpdated).toBe(true)
      expect(r2.success).toBe(true)
      expect(r2.textUpdated).toBe(false)
    })
  })

  describe('POST /api/note/bulk-suggest-titles', () => {
    it('suggests titles for notes with text but no title', async () => {
      const agent = await authedAgent()
      const n1 = await createNote(agent, { title: '', text: 'has text' })
      const n2 = await createNote(agent, { title: 'Already titled', text: 'has text' })
      const res = await agent
        .post('/api/note/bulk-suggest-titles')
        .send({ noteIds: [n1._id, n2._id] })
        .expect(200)
      const r1 = res.body.data.find(r => String(r.noteId) === String(n1._id))
      const r2 = res.body.data.find(r => String(r.noteId) === String(n2._id))
      expect(r1.titleUpdated).toBe(true)
      expect(r1.suggestedTitle).toMatch(/Mocked title/)
      expect(r2.titleUpdated).toBe(false)
    })
  })

  describe('POST /api/note/bulk-markdown', () => {
    it('returns nick + title rows for given note ids', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'Hello' })
      // Generate nick so this note can be exported
      await agent.put(`/api/nick/note/${note._id}`).expect(200)
      const res = await agent
        .post('/api/note/bulk-markdown')
        .send({ noteIds: [note._id] })
        .expect(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0].title).toBe('Hello')
      expect(res.body.data[0].nick).toMatch(/^n\d{6}$/)
    })

    it('returns failure rows when nick is missing', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'NoNick' })
      const res = await agent
        .post('/api/note/bulk-markdown')
        .send({ noteIds: [note._id] })
        .expect(200)
      expect(res.body.data[0].success).toBe(false)
      expect(res.body.data[0].error).toMatch(/Nick not found/)
    })
  })

  describe('POST /api/note/unified-search', () => {
    it('returns merged entity results for a query', async () => {
      const agent = await authedAgent()
      // Seed an author so the entity-name path returns something even though
      // semantic + keyword note paths are empty in tests.
      await agent.post('/api/auth/').send({ name: 'Aristotle' }).expect(201)
      const res = await agent
        .post('/api/note/unified-search')
        .send({ query: 'Aris', limit: 10 })
        .expect(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.some(r => r.type === 'auth' && r.item.name === 'Aristotle')).toBe(true)
    })

    it('returns empty array for empty query', async () => {
      const agent = await authedAgent()
      const res = await agent
        .post('/api/note/unified-search')
        .send({ query: '   ' })
        .expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })

  describe('POST /api/note/bulk-embed', () => {
    it('runs embed flow over notes (no-op when nothing stale)', async () => {
      const agent = await authedAgent()
      await createNote(agent, { title: 'X', text: 'Y' })
      const res = await agent.post('/api/note/bulk-embed').send({}).expect(200)
      expect(res.body.data).toBeDefined()
      // Result shape from controller: { processed, skipped, failed }
      expect(typeof res.body.data.processed).toBe('number')
    })
  })
})
