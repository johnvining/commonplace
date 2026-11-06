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
      expect(res.body.data).toMatchObject({ imported: 2, failed: 0 })
    })

    it('leaves the year empty when the year cell is empty (#349)', async () => {
      const agent = await authedAgent()
      const csv = 'Aristotle,Title,quote,Some Work,,,,,,,'
      await agent.put('/api/note/import/csv').send({ importList: csv }).expect(200)
      const notes = await agent.get('/api/note/all/1').expect(200)
      expect(notes.body.data).toHaveLength(1)
      expect(notes.body.data[0].year ?? null).toBeNull()
    })

    it('keeps a year from the year cell', async () => {
      const agent = await authedAgent()
      const csv = 'Aristotle,Title,quote,Some Work,,,,,1999,,'
      await agent.put('/api/note/import/csv').send({ importList: csv }).expect(200)
      const notes = await agent.get('/api/note/all/1').expect(200)
      expect(notes.body.data[0].year).toBe(1999)
    })

    it('imports nothing from empty input', async () => {
      const agent = await authedAgent()
      const res = await agent
        .put('/api/note/import/csv')
        .send({ importList: '' })
        .expect(200)
      expect(res.body.data).toEqual({ imported: 0, failed: 0, rows: [] })
    })

    it('reports each row, and keeps going past a row that fails (#374)', async () => {
      const agent = await authedAgent()
      const { default: Note } = await import('../src/resources/note/note.model.js')
      const real = Note.create.bind(Note)
      const spy = vi.spyOn(Note, 'create').mockImplementation(async (doc) => {
        if (doc?.title === 'Bad row') throw new Error('database said no')
        return real(doc)
      })
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const csv = ['A,Good one,text,W,,,,,,,', 'B,Bad row,text,W,,,,,,,', 'C,Good two,text,W,,,,,,,'].join('\n')
        const res = await agent.put('/api/note/import/csv').send({ importList: csv }).expect(200)
        const { imported, failed, rows } = res.body.data
        expect({ imported, failed }).toEqual({ imported: 2, failed: 1 })
        expect(rows[0]).toMatchObject({ row: 1, ok: true, stages: ['parsed', 'created', 'nicks'] })
        expect(rows[0].id).toMatch(/^[0-9a-f]{24}$/)
        expect(rows[1]).toMatchObject({ row: 2, ok: false, stages: ['parsed'], error: 'database said no' })
        expect(rows[2]).toMatchObject({ row: 3, ok: true })
      } finally {
        spy.mockRestore()
        quiet.mockRestore()
      }
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
      expect(res.body.data).toMatchObject({ imported: 2, failed: 0 })
    })

    it('keeps a quoted multi-line field in one note (#362)', async () => {
      const agent = await authedAgent()
      const tsv = 'Article\t"line one\nline two"\thttps://x.com/1\t\tTitle\n'
      const res = await agent
        .put('/api/note/import/instapaper')
        .send({ importList: tsv })
        .expect(200)
      expect(res.body.data).toMatchObject({ imported: 1, failed: 0 })
      const notes = await agent.get('/api/note/all/1').expect(200)
      expect(notes.body.data.map(n => n.text)).toEqual(['line one\nline two'])
    })

    it('keeps a bare quote inside an unquoted field', async () => {
      const agent = await authedAgent()
      const tsv = 'Article\tHe said "hi" twice\thttps://x.com/1\t\tTitle\n'
      const res = await agent
        .put('/api/note/import/instapaper')
        .send({ importList: tsv })
        .expect(200)
      expect(res.body.data).toMatchObject({ imported: 1, failed: 0 })
    })
  })

  describe('importCsvFromString (#374)', () => {
    it('rejects an unsupported record type loudly', async () => {
      const { importCsvFromString } = await import('../src/cli/import.js')
      await expect(importCsvFromString('a,b', 5)).rejects.toMatchObject({ status: 400, message: /Unsupported record type 5/ })
    })

    it('imports works from text as well as from a file', async () => {
      await authedAgent()
      const { importCsvFromString } = await import('../src/cli/import.js')
      const result = await importCsvFromString('Bowling Alone,Robert Putnam,2000,,', 2)
      expect(result).toMatchObject({ imported: 1, failed: 0 })
      expect(result.rows[0].stages).toEqual(['parsed', 'created', 'nicks'])
    })

    it('marks a row incomplete when its image cannot be downloaded', async () => {
      await authedAgent()
      const os = await import('os')
      const fs = await import('fs')
      const path = await import('path')
      const config = (await import('../src/config/index.js')).default
      const real = config.imageStorePath
      config.imageStorePath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cpimp-'))
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const { importCsvFromString } = await import('../src/cli/import.js')
        const tsv = 'Article\tText\thttps://x.com/1\thttps://127.0.0.1:1/missing.jpg\tTitle'
        const result = await importCsvFromString(tsv, 3)
        expect(result).toMatchObject({ imported: 0, failed: 1 })
        expect(result.rows[0]).toMatchObject({ ok: false, stages: ['parsed', 'created', 'nicks'] })
        expect(result.rows[0].error).toMatch(/1 of 1 images could not be downloaded/)
        expect(result.rows[0].id).toMatch(/^[0-9a-f]{24}$/)
      } finally {
        quiet.mockRestore()
        await fs.promises.rm(config.imageStorePath, { recursive: true, force: true })
        config.imageStorePath = real
      }
    })
  })
})

