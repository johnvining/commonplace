import { describe, expect, it } from 'vitest'
import { authedAgent, createAuthor, createNote, createPile, createWork } from './setup.js'

describe('merge (#360)', () => {
  describe('POST /api/work/:id/merge', () => {
    it('moves notes, piles and authors to the kept work and deletes the other', async () => {
      const agent = await authedAgent()
      const author = await createAuthor(agent, 'A')
      const pile = await createPile(agent, 'P')
      const keep = await createWork(agent, { name: 'Keep' })
      const drop = await createWork(agent, { name: 'Drop', authors: [author._id] })
      await agent.put(`/api/work/${drop._id}`).send({ year: 1999 }).expect(200)
      await agent.put(`/api/work/${drop._id}/pile`).send({ id: pile._id }).expect(200)
      const note = await createNote(agent, { title: 'N', work: drop._id })
      const dropNick = (await agent.put(`/api/nick/work/${drop._id}`).expect(200)).body.data.key
      await agent.put('/api/pin').send({ type: 'work', id: drop._id, label: 'Drop' }).expect(200)

      const res = await agent.post(`/api/work/${drop._id}/merge`).send({ into: keep._id }).expect(200)
      expect(res.body.data).toMatchObject({ notes: 1, piles: 1, authors: 1, fields: ['year'] })

      const kept = (await agent.get(`/api/work/${keep._id}`).expect(200)).body.data
      expect(kept.year).toBe(1999)
      expect(kept.authors.map(a => a._id ?? a)).toEqual([author._id])
      expect(kept.piles.map(p => p._id ?? p)).toEqual([pile._id])
      const notes = (await agent.get(`/api/work/${keep._id}/notes`).expect(200)).body.data
      expect(notes.map(n => n._id)).toEqual([note._id])
      const gone = await agent.get(`/api/work/${drop._id}`)
      expect(gone.body.data ?? null).toBeFalsy()
      expect((await agent.get(`/api/nick/${dropNick}`).expect(200)).body.data).toMatchObject({ retired: true, name: 'Drop' })
      const pins = (await agent.get('/api/pin').expect(200)).body.data
      expect(pins.map(p => p.id)).toEqual([keep._id])
    })

    it('only reports the plan on a dry run', async () => {
      const agent = await authedAgent()
      const keep = await createWork(agent, { name: 'Keep' })
      const drop = await createWork(agent, { name: 'Drop' })
      await createNote(agent, { title: 'N', work: drop._id })
      const res = await agent.post(`/api/work/${drop._id}/merge`).send({ into: keep._id, dryRun: true }).expect(200)
      expect(res.body.data.notes).toBe(1)
      const notes = (await agent.get(`/api/work/${drop._id}/notes`).expect(200)).body.data
      expect(notes).toHaveLength(1)
    })

    it('refuses to merge a work into itself', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent)
      await agent.post(`/api/work/${work._id}/merge`).send({ into: work._id }).expect(400)
    })
  })

  describe('POST /api/auth/:id/merge', () => {
    it('replaces the author in place on works and notes and deletes it', async () => {
      const agent = await authedAgent()
      const first = await createAuthor(agent, 'First')
      const keep = await createAuthor(agent, 'Keep')
      const drop = await createAuthor(agent, 'Drop')
      await agent.put(`/api/auth/${drop._id}`).send({ birth_year: 1900 }).expect(200)
      // drop is the byline here; keep already second, so it must not double up
      const work = await createWork(agent, { name: 'W', authors: [drop._id, first._id, keep._id] })
      const note = await createNote(agent, { title: 'N', authors: [drop._id] })

      const res = await agent.post(`/api/auth/${drop._id}/merge`).send({ into: keep._id }).expect(200)
      expect(res.body.data).toMatchObject({ works: 1, notes: 1, fields: ['birth_year'] })

      const w = (await agent.get(`/api/work/${work._id}`).expect(200)).body.data
      expect(w.authors.map(a => a._id ?? a)).toEqual([keep._id, first._id])
      const n = (await agent.get(`/api/note/${note._id}`).expect(200)).body.data
      expect((Array.isArray(n) ? n[0] : n).authors.map(a => a._id ?? a)).toEqual([keep._id])
      expect((await agent.get(`/api/auth/${keep._id}`).expect(200)).body.data.birth_year).toBe(1900)
      const gone = await agent.get(`/api/auth/${drop._id}`)
      expect(gone.body.data ?? null).toBeFalsy()
    })
  })
})
