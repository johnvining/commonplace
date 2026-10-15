import { beforeAll, describe, expect, it, vi } from 'vitest'
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
    expect(res.body.data.map((t) => t.id)).toEqual(['trim-entity-names', 'add-work-ideas', 'ocr-backlog'])
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

  it('404s for unknown tasks and jobs', async () => {
    const agent = await authedAgent()
    await agent.post('/api/maintenance/nope/run').send({ dryRun: true }).expect(404)
    await agent.get('/api/maintenance/jobs/nope').expect(404)
  })
})
