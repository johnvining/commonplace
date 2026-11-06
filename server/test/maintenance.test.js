import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { authedAgent } from './setup.js'

vi.mock('../src/utils/suggestions.js', async (orig) => {
  const actual = await orig()
  return { ...actual, getOpenAiOCR: vi.fn(async () => 'read from image') }
})
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

let models
beforeAll(async () => {
  const config = (await import('../src/config/index.js')).default
  config.secrets.openaikey = 'test-key'
  models = {
    Auth: (await import('../src/resources/auth/auth.model.js')).Auth,
    Idea: (await import('../src/resources/idea/idea.model.js')).default,
    Work: (await import('../src/resources/work/work.model.js')).default,
    Note: (await import('../src/resources/note/note.model.js')).default,
    Pile: (await import('../src/resources/pile/pile.model.js')).default,
  }
})

async function runJob(agent, taskId, dryRun) {
  const start = await agent.post(`/api/maintenance/${taskId}/run`).send({ dryRun }).expect(202)
  for (let i = 0; i < 100; i++) {
    const job = (await agent.get(`/api/maintenance/jobs/${start.body.data.jobId}`).expect(200)).body.data
    if (job.status !== 'running') return job
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('job did not finish')
}

describe('maintenance tasks', () => {
  it('lists tasks in run order, all pending at first', async () => {
    const agent = await authedAgent()
    const res = await agent.get('/api/maintenance/').expect(200)
    expect(res.body.data.map((t) => t.id)).toEqual([
      'trim-entity-names', 'add-work-ideas', 'ocr-backlog', 'clear-ocr-refusals', 'remove-missing-authors',
      'tidy-note-links', 'reconcile-images', 'refresh-embeddings',
    ])
    expect(res.body.data.every((t) => t.pending && t.lastRun === null)).toBe(true)
  })

  it('trims names on a real run only, including authors', async () => {
    const agent = await authedAgent()
    // Raw inserts: the schema would trim these on save.
    await models.Auth.collection.insertOne({ name: ' Seneca ' })
    await models.Idea.collection.insertMany([{ name: ' Stoicism' }, { name: 'Stoicism' }, { name: '  ' }])

    const dry = await runJob(agent, 'trim-entity-names', true)
    expect(dry.status).toBe('done')
    expect(dry.output).toContain('authors: would trim 1, blank 0')
    expect(dry.output.some((l) => l.startsWith('ideas: would trim 2, blank 1'))).toBe(true)
    expect(dry.output.some((l) => l.includes('"Stoicism" x2'))).toBe(true)
    expect((await models.Auth.collection.findOne({})).name).toBe(' Seneca ')
    expect((await agent.get('/api/maintenance/').expect(200)).body.data[0].pending).toBe(true)

    const real = await runJob(agent, 'trim-entity-names', false)
    expect(real.status).toBe('done')
    expect((await models.Auth.collection.findOne({})).name).toBe('Seneca')
    const list = (await agent.get('/api/maintenance/').expect(200)).body.data
    expect(list[0].pending).toBe(false)
    expect(list[0].lastRun.ok).toBe(true)

    const again = await runJob(agent, 'trim-entity-names', false)
    expect(again.output).toContain('authors: trimmed 0, blank 0')
  })

  it('adds missing ideas lists to works', async () => {
    const agent = await authedAgent()
    await models.Work.collection.insertMany([{ name: 'a' }, { name: 'b', ideas: [] }])
    expect((await runJob(agent, 'add-work-ideas', true)).output).toEqual(['works: would update 1'])
    expect((await runJob(agent, 'add-work-ideas', false)).output).toEqual(['works: updated 1'])
    expect(await models.Work.collection.countDocuments({ ideas: { $exists: false } })).toBe(0)
  })

  it('fills in old image notes, without touching notes that have text', async () => {
    const agent = await authedAgent()
    await models.Note.collection.insertMany([
      { title: 'blank', images: ['x/1-a.jpg'] },
      { title: 'typed', text: 'mine', images: ['x/1-b.jpg'] },
    ])
    const dry = await runJob(agent, 'ocr-backlog', true)
    expect(dry.output[0]).toMatch(/^1 image notes without text; would process 1/)
    const real = await runJob(agent, 'ocr-backlog', false)
    expect(real.status).toBe('done')
    expect((await models.Note.collection.findOne({ title: 'blank' })).text).toBe('read from image')
    expect((await models.Note.collection.findOne({ title: 'typed' })).text).toBe('mine')
  })

  it('clears OCR apologies from image notes, and nothing else', async () => {
    const agent = await authedAgent()
    await models.Note.collection.insertMany([
      { title: 'painting', text: "Sorry, I can't transcribe the text from this image.", images: ['x/1-a.jpg'] },
      { title: 'photo', text: 'I cannot transcribe the text from the image you provided.', images: ['x/1-b.jpg'] },
      { title: 'real', text: 'Sorry for the delay, the text of the letter follows.\n\n' + 'Dear sir. '.repeat(40), images: ['x/1-c.jpg'] },
      { title: 'typed', text: 'no visible text here, said nobody', images: [] },
    ])
    const dry = await runJob(agent, 'clear-ocr-refusals', true)
    expect(dry.output.at(-1)).toMatch(/^would clear 2 of/)
    expect((await models.Note.collection.findOne({ title: 'painting' })).text).toMatch(/^Sorry/)
    await runJob(agent, 'clear-ocr-refusals', false)
    expect((await models.Note.collection.findOne({ title: 'painting' })).text).toBe('')
    expect((await models.Note.collection.findOne({ title: 'photo' })).text).toBe('')
    expect((await models.Note.collection.findOne({ title: 'real' })).text).toMatch(/^Sorry for the delay/)
    expect((await models.Note.collection.findOne({ title: 'typed' })).text).toMatch(/^no visible/)
  })

  it('removes links to deleted authors, keeping the rest (#345)', async () => {
    const agent = await authedAgent()
    const mongoose = (await import('mongoose')).default
    const real = await models.Auth.create({ name: 'Real' })
    const gone = new mongoose.Types.ObjectId()
    const noteId = (await models.Note.collection.insertOne({ title: 'N', authors: [gone, real._id], people: [gone] })).insertedId
    const workId = (await models.Work.collection.insertOne({ name: 'W', authors: [real._id], editors: [gone] })).insertedId
    await agent.put('/api/pin').send({ type: 'auth', id: String(gone), label: 'Gone' }).expect(200)
    await agent.put('/api/pin').send({ type: 'auth', id: String(real._id), label: 'Real' }).expect(200)

    const dry = await runJob(agent, 'remove-missing-authors', true)
    expect(dry.output).toContain('note authors: 1 missing authors on 1 records, would remove')
    expect(dry.output).toContain('stars: 1 on missing authors, would remove')
    expect((await models.Note.collection.findOne({ _id: noteId })).authors).toHaveLength(2)

    await runJob(agent, 'remove-missing-authors', false)
    const note = await models.Note.collection.findOne({ _id: noteId })
    expect(note.authors.map(String)).toEqual([String(real._id)])
    expect(note.people).toEqual([])
    const work = await models.Work.collection.findOne({ _id: workId })
    expect(work.authors.map(String)).toEqual([String(real._id)])
    expect(work.editors).toEqual([])
    const pins = (await agent.get('/api/pin').expect(200)).body.data
    expect(pins.map((p) => p.label)).toEqual(['Real'])

    const again = await runJob(agent, 'remove-missing-authors', false)
    expect(again.output).toContain('note authors: 0 missing authors on 0 records')
  })

  it('tidies existing links into one canonical row per pair (#371)', async () => {
    const agent = await authedAgent()
    const { default: Link } = await import('../src/resources/link/link.model.js')
    const mongoose = (await import('mongoose')).default
    await Link.collection.dropIndexes().catch(() => {})
    const { insertedIds } = await models.Note.collection.insertMany([{ title: 'A' }, { title: 'B' }])
    const [a, b] = Object.values(insertedIds)
    const [lo, hi] = String(a) < String(b) ? [a, b] : [b, a]
    await Link.collection.insertMany([
      { left_note: hi, right_note: lo },
      { left_note: lo, right_note: hi },
      { left_note: lo, right_note: lo },
      { left_note: lo, right_note: new mongoose.Types.ObjectId() },
    ])
    const dry = await runJob(agent, 'tidy-note-links', true)
    expect(dry.output[0]).toBe('links: 4 checked; would remove 1 self-links, 1 to deleted notes, 1 duplicates; would reorder 1')
    expect(await Link.countDocuments({})).toBe(4)

    const real = await runJob(agent, 'tidy-note-links', false)
    expect(real.status).toBe('done')
    const left = await Link.find({}).lean()
    expect(left.map((l) => [String(l.left_note), String(l.right_note)])).toEqual([[String(lo), String(hi)]])
    await expect(Link.collection.insertOne({ left_note: lo, right_note: hi })).rejects.toThrow(/duplicate key/)
  })

  describe('reconcile images (#368)', () => {
    let root, config, realRoot
    beforeAll(async () => {
      config = (await import('../src/config/index.js')).default
      realRoot = config.imageStorePath
    })
    beforeEach(async () => {
      root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cprec-'))
      config.imageStorePath = root
    })
    afterEach(async () => {
      config.imageStorePath = realRoot
      await fs.promises.rm(root, { recursive: true, force: true })
    })
    const write = (rel) => {
      fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true })
      fs.writeFileSync(path.join(root, rel), 'x')
    }

    const pileNames = async (id) => {
      const note = await models.Note.collection.findOne({ _id: id })
      const piles = await models.Pile.collection.find({ _id: { $in: note.piles ?? [] } }).toArray()
      return piles.map((p) => p.name).sort()
    }

    it('files notes into a pile per problem, and changes no image', async () => {
      const agent = await authedAgent()
      const { insertedIds } = await models.Note.collection.insertMany([{ title: 'A' }, { title: 'B' }, { title: 'C' }])
      const [a, b, c] = Object.values(insertedIds).map((id) => [id, String(id)])
      write(`${a[1]}/kept.jpg`)
      write(`${a[1]}/extra.jpg`)
      write(`${b[1]}/1-lost.jpg`)
      write('aaaaaaaaaaaaaaaaaaaaaaaa/of-deleted-note.jpg')
      write('loose-top-level.jpg')
      const images = {
        [a[1]]: [`${a[1]}/kept.jpg`, `${a[1]}/gone.jpg`],
        [b[1]]: [null, ''],
        [c[1]]: [`${c[1]}/fine.jpg`],
      }
      write(`${c[1]}/fine.jpg`)
      for (const [id] of [a, b, c]) await models.Note.collection.updateOne({ _id: id }, { $set: { images: images[String(id)] } })
      const files = () => fs.readdirSync(root, { recursive: true }).sort()
      const before = files()

      const dry = await runJob(agent, 'reconcile-images', true)
      expect(dry.status).toBe('done')
      expect(dry.output).toEqual([
        'Images: Missing file: 1 notes (1 of 3 listed files gone), would file',
        'Images: Blank entry: 1 notes (2 empty names), would file',
        'Images: Unlisted file: 2 notes (2 files), would file',
        'files in folders of deleted notes: 1, left alone — aaaaaaaaaaaaaaaaaaaaaaaa/of-deleted-note.jpg',
      ])
      expect(await models.Pile.collection.countDocuments({})).toBe(0)

      const real = await runJob(agent, 'reconcile-images', false)
      expect(real.status).toBe('done')
      expect(await pileNames(a[0])).toEqual(['Images: Missing file', 'Images: Unlisted file'])
      expect(await pileNames(b[0])).toEqual(['Images: Blank entry', 'Images: Unlisted file'])
      expect(await pileNames(c[0])).toEqual([])
      // Nothing about the images themselves changed
      expect(files()).toEqual(before)
      for (const [id] of [a, b, c]) {
        expect((await models.Note.collection.findOne({ _id: id })).images).toEqual(images[String(id)])
      }

      // Fixed notes leave the pile on the next run
      await models.Note.collection.updateOne({ _id: a[0] }, { $set: { images: [`${a[1]}/kept.jpg`, `${a[1]}/extra.jpg`] } })
      await runJob(agent, 'reconcile-images', false)
      expect(await pileNames(a[0])).toEqual([])
      expect(await pileNames(b[0])).toEqual(['Images: Blank entry', 'Images: Unlisted file'])
    })
  })

  it('404s for unknown tasks and jobs', async () => {
    const agent = await authedAgent()
    await agent.post('/api/maintenance/nope/run').send({ dryRun: true }).expect(404)
    await agent.get('/api/maintenance/jobs/nope').expect(404)
  })
})
