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
      // The merged work's nick now leads to the kept work (#366)
      expect((await agent.get(`/api/nick/${dropNick}`).expect(200)).body.data).toMatchObject({ key: dropNick, work: keep._id, mergedFrom: 'Drop' })
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

  describe('nicks of merged works (#366)', () => {
    async function nick(agent, id) {
      return (await agent.put(`/api/nick/work/${id}`).expect(200)).body.data.key
    }
    const resolve = async (agent, key) => (await agent.get(`/api/nick/${key}`).expect(200)).body.data

    it('follow a chain of merges, and retire when the kept work is deleted', async () => {
      const agent = await authedAgent()
      const a = await createWork(agent, { name: 'A' })
      const b = await createWork(agent, { name: 'B' })
      const c = await createWork(agent, { name: 'C' })
      const aKey = await nick(agent, a._id)
      const bKey = await nick(agent, b._id)
      const cKey = await nick(agent, c._id)

      await agent.post(`/api/work/${a._id}/merge`).send({ into: b._id }).expect(200)
      expect((await resolve(agent, aKey)).work).toBe(b._id)
      // B keeps its own nick
      expect((await resolve(agent, bKey)).work).toBe(b._id)

      await agent.post(`/api/work/${b._id}/merge`).send({ into: c._id }).expect(200)
      expect((await resolve(agent, aKey)).work).toBe(c._id)
      expect((await resolve(agent, bKey))).toMatchObject({ work: c._id, mergedFrom: 'B' })
      expect((await resolve(agent, cKey)).work).toBe(c._id)

      await agent.delete(`/api/work/${c._id}`).expect(204)
      for (const [key, name] of [[aKey, 'A'], [bKey, 'B'], [cKey, 'C']]) {
        const data = await resolve(agent, key)
        expect(data).toMatchObject({ retired: true, name })
        expect(data.work).toBeUndefined()
      }
    })
  })

  describe('plans are re-checked when executed (#369)', () => {
    it('refuses a work merge whose plan changed since the preview, and runs the current one', async () => {
      const agent = await authedAgent()
      const keep = await createWork(agent, { name: 'Keep' })
      const drop = await createWork(agent, { name: 'Drop' })
      await createNote(agent, { title: 'First', work: drop._id })
      const preview = (await agent.post(`/api/work/${drop._id}/merge`).send({ into: keep._id, dryRun: true }).expect(200)).body.data
      expect(preview).toMatchObject({ notes: 1 })
      expect(preview.fingerprint).toMatch(/^[0-9a-f]{16}$/)

      // Something changes before the merge is confirmed
      await createNote(agent, { title: 'Second', work: drop._id })
      const refused = await agent.post(`/api/work/${drop._id}/merge`).send({ into: keep._id, expect: preview.fingerprint }).expect(409)
      expect(refused.body.data).toMatchObject({ notes: 2 })
      expect(refused.body.data.fingerprint).not.toBe(preview.fingerprint)
      expect((await agent.get(`/api/work/${drop._id}`).expect(200)).body.data.name).toBe('Drop')

      await agent.post(`/api/work/${drop._id}/merge`).send({ into: keep._id, expect: refused.body.data.fingerprint }).expect(200)
      expect((await agent.get(`/api/work/${keep._id}/notes`).expect(200)).body.data).toHaveLength(2)
    })

    it('gives the same fingerprint for the same data', async () => {
      const agent = await authedAgent()
      const keep = await createAuthor(agent, 'Keep')
      const drop = await createAuthor(agent, 'Drop')
      await createNote(agent, { title: 'N', authors: [drop._id] })
      const one = (await agent.post(`/api/auth/${drop._id}/merge`).send({ into: keep._id, dryRun: true }).expect(200)).body.data
      const two = (await agent.post(`/api/auth/${drop._id}/merge`).send({ into: keep._id, dryRun: true }).expect(200)).body.data
      expect(two.fingerprint).toBe(one.fingerprint)
    })

    it('re-checks author merges and splits too', async () => {
      const agent = await authedAgent()
      const keep = await createAuthor(agent, 'Keep')
      const drop = await createAuthor(agent, 'A & B')
      const merge = (await agent.post(`/api/auth/${drop._id}/merge`).send({ into: keep._id, dryRun: true }).expect(200)).body.data
      const split = (await agent.post(`/api/auth/${drop._id}/split`).send({ names: ['A', 'B'], dryRun: true }).expect(200)).body.data
      await createWork(agent, { name: 'W', authors: [drop._id] })
      await agent.post(`/api/auth/${drop._id}/merge`).send({ into: keep._id, expect: merge.fingerprint }).expect(409)
      await agent.post(`/api/auth/${drop._id}/split`).send({ names: ['A', 'B'], expect: split.fingerprint }).expect(409)
      expect((await agent.get(`/api/auth/${drop._id}`).expect(200)).body.data.name).toBe('A & B')
    })
  })
})

