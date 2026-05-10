import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createWork } from './setup.js'

vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    embedNoteIfStale: vi.fn().mockResolvedValue(null),
  }
})

describe('note imports', () => {
  describe('PUT /api/note/import/work/:work', () => {
    it('imports notes split by line for the given work', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'Imported Book' })
      const text = 'first quote\nsecond quote\nthird quote\n'
      await agent
        .put(`/api/note/import/work/${work._id}`)
        .send({ notesText: text })
        .expect(200)
      const notesRes = await agent.get(`/api/work/${work._id}/notes`).expect(200)
      const titles = notesRes.body.data.map(n => n.text)
      expect(titles).toContain('first quote')
      expect(titles).toContain('second quote')
      expect(titles).toContain('third quote')
    })

    it('skips empty lines', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'Imported2' })
      await agent
        .put(`/api/note/import/work/${work._id}`)
        .send({ notesText: 'one\n\n\ntwo\n' })
        .expect(200)
      const notesRes = await agent.get(`/api/work/${work._id}/notes`).expect(200)
      expect(notesRes.body.data).toHaveLength(2)
    })
  })

  describe('PUT /api/note/import/csv', () => {
    it('imports notes from CSV (recordType=1)', async () => {
      const agent = await authedAgent()
      // Schema: Author,Title,Text,WorkName,Url,Ideas,ImageUrls,Piles,Year,Page,Take
      // Empty ImageUrls (col 6) becomes [''] which short-circuits image download
      const csv = [
        'Aristotle,Book A title,quote one,Some Work,,,,,,,',
        'Plato,Book B title,quote two,Other Work,,,,,,,',
      ].join('\n')
      const res = await agent
        .put('/api/note/import/csv')
        .send({ importList: csv })
        .expect(200)
      expect(res.body.data).toBe(2)
    })

    it('returns null for empty input', async () => {
      const agent = await authedAgent()
      const res = await agent
        .put('/api/note/import/csv')
        .send({ importList: '' })
        .expect(200)
      expect(res.body.data).toBe(0)
    })
  })

  describe('PUT /api/note/import/instapaper', () => {
    it('imports notes from Instapaper TSV (recordType=3)', async () => {
      const agent = await authedAgent()
      // Schema: Article(work)\tText\tNoteUrl\tImageUrl\tTitle
      const tsv = [
        'Article 1\tParagraph one\thttps://x.com/1\t\tTitle 1',
        'Article 2\tParagraph two\thttps://x.com/2\t\tTitle 2',
      ].join('\n')
      const res = await agent
        .put('/api/note/import/instapaper')
        .send({ importList: tsv })
        .expect(200)
      expect(res.body.data).toBe(2)
    })
  })
})
