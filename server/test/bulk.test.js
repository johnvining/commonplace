import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createIdea, createNote, createPile, createWork } from './setup.js'

const ids = (list) => list.map(x => x._id ?? x)

async function getNote(agent, id) {
  const data = (await agent.get(`/api/note/${id}`).expect(200)).body.data
  return Array.isArray(data) ? data[0] : data
}

describe('bulk writes (#356)', () => {
  describe('POST /api/note/bulk-update', () => {
    it('sets the work and adds ideas and piles on every note', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'W' })
      const idea = await createIdea(agent)
      const pile = await createPile(agent)
      const a = await createNote(agent, { title: 'A' })
      const b = await createNote(agent, { title: 'B' })
      const res = await agent.post('/api/note/bulk-update')
        .send({ ids: [a._id, b._id], work: work._id, ideas: [idea._id], piles: [pile._id] })
        .expect(200)
      expect(res.body.data).toEqual({ matched: 2, modified: 2 })
      for (const id of [a._id, b._id]) {
        const note = await getNote(agent, id)
        expect(note.work._id).toBe(work._id)
        expect(ids(note.ideas)).toEqual([idea._id])
        expect(ids(note.piles)).toEqual([pile._id])
      }
    })

    it('rejects a request with no changes or bad ids', async () => {
      const agent = await authedAgent()
      const a = await createNote(agent, { title: 'A' })
      await agent.post('/api/note/bulk-update').send({ ids: [a._id] }).expect(400)
      await agent.post('/api/note/bulk-update').send({ ids: ['nope'], work: null }).expect(400)
      await agent.post('/api/note/bulk-update').send({ ids: [], work: null }).expect(400)
    })
  })

  describe('POST /api/note/link-by-title', () => {
    it('links unlinked notes titled like the work, leaving linked ones alone', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'Bowling Alone' })
      const other = await createWork(agent, { name: 'Other' })
      const loose = await createNote(agent, { title: ' bowling alone ' })
      const linked = await createNote(agent, { title: 'Bowling Alone', work: other._id })
      await createNote(agent, { title: 'Bowling Alone, again' })

      const dry = (await agent.post('/api/note/link-by-title').send({ work: work._id, dryRun: true }).expect(200)).body.data
      expect(dry.matched).toBe(1)
      expect((await getNote(agent, loose._id)).work ?? null).toBeNull()

      await agent.post('/api/note/link-by-title').send({ work: work._id }).expect(200)
      expect((await getNote(agent, loose._id)).work._id).toBe(work._id)
      expect((await getNote(agent, linked._id)).work._id).toBe(other._id)

      const all = (await agent.post('/api/note/link-by-title').send({ work: work._id, all: true }).expect(200)).body.data
      expect(all).toMatchObject({ matched: 1, fromOtherWorks: 1 })
      expect((await getNote(agent, linked._id)).work._id).toBe(work._id)
    })
  })

  describe('POST /api/auth/:id/split', () => {
    it('replaces a combined author with one per name, reusing existing ones', async () => {
      const agent = await authedAgent()
      const combined = await createAuthor(agent, 'Dierdre McCloskey,Stephen T. Ziliak')
      const existing = await createAuthor(agent, 'Stephen T. Ziliak')
      const other = await createAuthor(agent, 'Other')
      const work = await createWork(agent, { name: 'W', authors: [combined._id, other._id] })
      const note = await createNote(agent, { title: 'N', authors: [combined._id] })

      const res = await agent.post(`/api/auth/${combined._id}/split`)
        .send({ names: ['Dierdre McCloskey', 'stephen t. ziliak'] })
        .expect(200)
      const plan = res.body.data
      expect(plan).toMatchObject({ works: 1, notes: 1, deletesOld: true })
      expect(plan.into[1]).toMatchObject({ _id: existing._id, existing: true })
      const created = plan.into[0]._id

      const w = (await agent.get(`/api/work/${work._id}`).expect(200)).body.data
      expect(ids(w.authors)).toEqual([created, existing._id, other._id])
      expect(ids((await getNote(agent, note._id)).authors)).toEqual([created, existing._id])
      const gone = await agent.get(`/api/auth/${combined._id}`)
      expect(gone.body.data ?? null).toBeFalsy()
    })

    it('creates nothing on a dry run', async () => {
      const agent = await authedAgent()
      const combined = await createAuthor(agent, 'A & B')
      const res = await agent.post(`/api/auth/${combined._id}/split`).send({ names: ['A', 'B'], dryRun: true }).expect(200)
      expect(res.body.data.into).toEqual([
        { name: 'A', _id: null, existing: false },
        { name: 'B', _id: null, existing: false },
      ])
      const found = (await agent.post('/api/auth/autocomplete').send({ string: 'A' }).expect(200)).body.data
      expect(found.map(a => a.name)).toEqual(['A & B'])
    })
  })
})
