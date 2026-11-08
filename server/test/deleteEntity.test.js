import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { authedAgent, createAuthor, createIdea, createNote, createPile, createWork } from './setup.js'
import Pin from '../src/resources/pin/pin.model.js'
import Link from '../src/resources/link/link.model.js'
import Note from '../src/resources/note/note.model.js'
import Work from '../src/resources/work/work.model.js'
import config from '../src/config/index.js'
import { CASCADE } from '../src/utils/deleteEntity.js'

vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

// Image files go to a temporary folder, never the configured store
let imageStoreRoot, realImageStore
beforeAll(async () => {
  imageStoreRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cpdel-'))
  realImageStore = config.imageStorePath
  config.imageStorePath = imageStoreRoot
})
afterAll(async () => {
  config.imageStorePath = realImageStore
  await fs.promises.rm(imageStoreRoot, { recursive: true, force: true })
})

const star = (agent, type, id) => agent.put('/api/pin').send({ type, id: String(id), label: type }).expect(200)

describe('one delete path for every entity (#372)', () => {
  it('lists a star step and a nick step for every type (#382)', () => {
    for (const steps of Object.values(CASCADE)) {
      const labels = steps('000000000000000000000000').map(([label]) => label)
      expect(labels).toContain('star')
      expect(labels).toContain('nick')
    }
  })

  it.each([
    ['note', (agent) => createNote(agent, { title: 'N' }), (id) => `/api/note/${id}`, 200],
    ['work', (agent) => createWork(agent, { name: 'W' }), (id) => `/api/work/${id}`, 204],
    ['idea', (agent) => createIdea(agent), (id) => `/api/idea/${id}`, 204],
    ['pile', (agent) => createPile(agent, 'P'), (id) => `/api/pile/${id}`, 204],
    ['auth', (agent) => createAuthor(agent, 'A'), (id) => `/api/auth/${id}`, 204],
  ])('deleting a %s unstars it', async (type, make, url, status) => {
    const agent = await authedAgent()
    const entity = await make(agent)
    await star(agent, type, entity._id)
    await agent.delete(url(entity._id)).expect(status)
    expect(await Pin.countDocuments({ type, target: String(entity._id) })).toBe(0)
    // Deleting again is harmless
    await agent.delete(url(entity._id)).expect(status)
  })

  it("removes a note's links and image files with it", async () => {
    const agent = await authedAgent()
    const a = await createNote(agent, { title: 'A' })
    const b = await createNote(agent, { title: 'B' })
    await agent.put('/api/link/').send({ fromId: a._id, toId: b._id }).expect(200)
    const dir = path.join(config.imageStorePath, String(a._id))
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'img.jpg'), 'x')
    await Note.updateOne({ _id: a._id }, { $set: { images: [`${a._id}/img.jpg`] } })
    await agent.delete(`/api/note/${a._id}`).expect(200)
    expect(await Link.countDocuments({})).toBe(0)
    expect(fs.existsSync(dir)).toBe(false)
  })

  it('unlinks notes from a deleted work, idea and pile', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'W' })
    const idea = await createIdea(agent)
    const pile = await createPile(agent, 'P')
    const note = await createNote(agent, { title: 'N', work: work._id, ideas: [idea._id], piles: [pile._id] })
    await agent.delete(`/api/work/${work._id}`).expect(204)
    await agent.delete(`/api/idea/${idea._id}`).expect(204)
    await agent.delete(`/api/pile/${pile._id}`).expect(204)
    const left = await Note.findById(note._id).lean()
    expect(left.work ?? null).toBeNull()
    expect(left.ideas).toEqual([])
    expect(left.piles).toEqual([])
  })

  it('keeps the record when a cleanup step fails, so the delete can be retried', async () => {
    const agent = await authedAgent()
    const work = await createWork(agent, { name: 'Kept' })
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const spy = vi.spyOn(Pin, 'deleteMany').mockImplementationOnce(() => ({ exec: () => Promise.reject(new Error('down')) }))
    try {
      const res = await agent.delete(`/api/work/${work._id}`)
      expect(res.status).toBe(500)
    } finally {
      spy.mockRestore()
      quiet.mockRestore()
    }
    expect(await Work.exists({ _id: work._id })).toBeTruthy()
    await agent.delete(`/api/work/${work._id}`).expect(204)
    expect(await Work.exists({ _id: work._id })).toBeFalsy()
  })
})
