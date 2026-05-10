import { describe, expect, it } from 'vitest'
import { authedAgent, createNote } from './setup.js'

async function nickFor(agent, noteId) {
  const res = await agent.put(`/api/nick/note/${noteId}`).expect(200)
  return res.body.data.key
}

describe('link', () => {
  describe('PUT /api/link/ (create link)', () => {
    it('creates a link between two notes by their nicks', async () => {
      const agent = await authedAgent()
      const a = await createNote(agent, { title: 'A' })
      const b = await createNote(agent, { title: 'B' })
      const aNick = await nickFor(agent, a._id)
      const bNick = await nickFor(agent, b._id)
      const res = await agent
        .put('/api/link/')
        .send({ leftNoteNick: aNick, rightNoteNick: bNick })
        .expect(200)
      expect(String(res.body.data.left_note)).toBe(String(a._id))
      expect(String(res.body.data.right_note)).toBe(String(b._id))
    })

    it('returns existing link when same pair is linked twice', async () => {
      const agent = await authedAgent()
      const a = await createNote(agent, { title: 'A' })
      const b = await createNote(agent, { title: 'B' })
      const aNick = await nickFor(agent, a._id)
      const bNick = await nickFor(agent, b._id)
      const first = await agent.put('/api/link/').send({ leftNoteNick: aNick, rightNoteNick: bNick }).expect(200)
      const second = await agent.put('/api/link/').send({ leftNoteNick: aNick, rightNoteNick: bNick }).expect(200)
      expect(String(second.body.data._id)).toBe(String(first.body.data._id))
    })

    it('treats inverse direction as the same link', async () => {
      const agent = await authedAgent()
      const a = await createNote(agent, { title: 'A' })
      const b = await createNote(agent, { title: 'B' })
      const aNick = await nickFor(agent, a._id)
      const bNick = await nickFor(agent, b._id)
      const fwd = await agent.put('/api/link/').send({ leftNoteNick: aNick, rightNoteNick: bNick }).expect(200)
      const rev = await agent.put('/api/link/').send({ leftNoteNick: bNick, rightNoteNick: aNick }).expect(200)
      expect(String(rev.body.data._id)).toBe(String(fwd.body.data._id))
    })
  })

  describe('GET /api/link/note/:id', () => {
    it('returns notes linked to the given note', async () => {
      const agent = await authedAgent()
      const a = await createNote(agent, { title: 'A' })
      const b = await createNote(agent, { title: 'B' })
      const c = await createNote(agent, { title: 'C' })
      const aNick = await nickFor(agent, a._id)
      const bNick = await nickFor(agent, b._id)
      const cNick = await nickFor(agent, c._id)
      await agent.put('/api/link/').send({ leftNoteNick: aNick, rightNoteNick: bNick }).expect(200)
      await agent.put('/api/link/').send({ leftNoteNick: cNick, rightNoteNick: aNick }).expect(200)

      const res = await agent.get(`/api/link/note/${a._id}`).expect(200)
      const linkedIds = res.body.data.map(n => String(n._id))
      expect(linkedIds).toContain(String(b._id))
      expect(linkedIds).toContain(String(c._id))
      expect(linkedIds).not.toContain(String(a._id))
    })

    it('returns empty array when note has no links', async () => {
      const agent = await authedAgent()
      const a = await createNote(agent, { title: 'A' })
      const res = await agent.get(`/api/link/note/${a._id}`).expect(200)
      expect(res.body.data).toHaveLength(0)
    })
  })
})
