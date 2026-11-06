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
      // Notes get a nick when created (#367); a legacy note may not have one
      const { default: Note } = await import('../src/resources/note/note.model.js')
      const { insertedId } = await Note.collection.insertOne({ title: 'NoNick' })
      const res = await agent
        .post('/api/note/bulk-markdown')
        .send({ noteIds: [String(insertedId)] })
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

    it('accepts any limit, capping it', async () => {
      const agent = await authedAgent()
      await agent.post('/api/auth/').send({ name: 'Aristotle' }).expect(201)
      for (const limit of [100000, 'lots', -5]) {
        const res = await agent.post('/api/note/unified-search').send({ query: 'Aris', limit }).expect(200)
        expect(res.body.data.some(r => r.item.name === 'Aristotle')).toBe(true)
      }
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

  describe('AI-generated title mark', () => {
    it('records bulk-suggested titles as AI-made', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'has text' })
      await agent.post('/api/note/bulk-suggest-titles').send({ noteIds: [note._id] }).expect(200)
      const saved = (await agent.get(`/api/note/${note._id}`).expect(200)).body.data[0]
      expect(saved.aiTitle).toBe(saved.title)
    })

    it('records a single suggestion, which matches the title once saved', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'Lorem ipsum' })
      const { suggested_title } = (await agent.get(`/api/note/${note._id}/title/suggest`).expect(200)).body
      await agent.put(`/api/note/${note._id}`).send({ title: suggested_title }).expect(200)
      let saved = (await agent.get(`/api/note/${note._id}`).expect(200)).body.data[0]
      expect(saved.title).toBe(saved.aiTitle)

      await agent.put(`/api/note/${note._id}`).send({ title: suggested_title + ', edited' }).expect(200)
      saved = (await agent.get(`/api/note/${note._id}`).expect(200)).body.data[0]
      expect(saved.title).not.toBe(saved.aiTitle)
    })

    it('cannot be set by clients', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'Mine' })
      await agent.put(`/api/note/${note._id}`).send({ aiTitle: 'Mine' }).expect(400)
    })
  })

  describe('title source (#370)', () => {
    const source = async (id) => (await (await import('../src/resources/note/note.model.js')).default.findById(id).lean()).titleSource

    it('marks a saved suggestion ai-accepted, and typing the same words as the user’s', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'Lorem ipsum' })
      expect(await source(note._id)).toBe('user')
      const { suggested_title } = (await agent.get(`/api/note/${note._id}/title/suggest`).expect(200)).body
      await agent.put(`/api/note/${note._id}`).send({ title: suggested_title, titleSource: 'ai-accepted' }).expect(200)
      expect(await source(note._id)).toBe('ai-accepted')
      // Typed by hand, even with the suggestion's exact words
      await agent.put(`/api/note/${note._id}`).send({ title: suggested_title, titleSource: 'user' }).expect(200)
      expect(await source(note._id)).toBe('user')
    })

    it('keeps the source when a save resends the title unchanged', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'has text' })
      await agent.post('/api/note/bulk-suggest-titles').send({ noteIds: [note._id] }).expect(200)
      const { title } = await (await import('../src/resources/note/note.model.js')).default.findById(note._id).lean()
      await agent.put(`/api/note/${note._id}`).send({ title, text: 'edited text' }).expect(200)
      expect(await source(note._id)).toBe('ai-suggested')
      // A changed title with no source is the user's
      await agent.put(`/api/note/${note._id}`).send({ title: title + '!' }).expect(200)
      expect(await source(note._id)).toBe('user')
    })

    it('refuses an AI claim for a title that is not the suggestion', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'Lorem ipsum' })
      await agent.get(`/api/note/${note._id}/title/suggest`).expect(200)
      await agent.put(`/api/note/${note._id}`).send({ title: 'Something else', titleSource: 'ai-accepted' }).expect(200)
      expect(await source(note._id)).toBe('user')
    })

    it('marks bulk-suggested titles ai-suggested through the same path', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: '', text: 'has text' })
      await agent.post('/api/note/bulk-suggest-titles').send({ noteIds: [note._id] }).expect(200)
      const saved = await (await import('../src/resources/note/note.model.js')).default.findById(note._id).lean()
      expect(saved).toMatchObject({ titleSource: 'ai-suggested', aiTitle: saved.title })
    })

    it('never infers a source from the title: no record means not sure', async () => {
      const { titleSourceOf } = await import('../src/utils/noteTitle.js')
      expect(titleSourceOf({ title: 'T', aiTitle: 'T' })).toBe(null)
      expect(titleSourceOf({ title: 'T', aiTitle: 'T', titleSource: 'ai-suggested' })).toBe('ai-suggested')
    })

    it('keeps an old note not sure until its title changes', async () => {
      const agent = await authedAgent()
      const Note = (await import('../src/resources/note/note.model.js')).default
      const id = (await Note.collection.insertOne({ title: 'Old', aiTitle: 'Old', text: 't' })).insertedId
      // The editor sends titleSource null for a title it isn't sure of
      await agent.put(`/api/note/${id}`).send({ title: 'Old', titleSource: null, text: 'edited' }).expect(200)
      expect(await source(id)).toBeUndefined()
      await agent.put(`/api/note/${id}`).send({ title: 'Old' }).expect(200)
      expect(await source(id)).toBeUndefined()
      // Typed: the user's
      await agent.put(`/api/note/${id}`).send({ title: 'New', titleSource: null }).expect(200)
      expect(await source(id)).toBe('user')
    })
  })
})

