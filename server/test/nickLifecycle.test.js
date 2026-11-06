import { describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'
import { authedAgent, createIdea, createNote, createPile, createWork } from './setup.js'
import Nick from '../src/resources/nick/nick.model.js'
import {
  TRANSITIONS,
  nextState,
  stateOf,
  mintNick,
  retireNick,
  repointNick,
  resolveNick,
} from '../src/resources/nick/nickLifecycle.js'

vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

const id = () => new mongoose.Types.ObjectId()

describe('nick lifecycle (#367)', () => {
  describe('transition table', () => {
    it('allows only the listed moves', () => {
      expect(nextState('unminted', 'mint')).toBe('active')
      expect(nextState('active', 'mint')).toBe('active')
      expect(nextState('active', 'retire')).toBe('retired')
      expect(nextState('active', 'repoint')).toBe('alias')
      expect(nextState('alias', 'repoint')).toBe('alias')
      expect(nextState('alias', 'retire')).toBe('retired')
      expect(() => nextState('retired', 'mint')).toThrow(/Cannot mint a nick that is retired/)
      expect(() => nextState('retired', 'repoint')).toThrow()
      expect(() => nextState('alias', 'mint')).toThrow()
    })

    it('never leads out of retired', () => {
      for (const moves of Object.values(TRANSITIONS)) expect(moves.retired).toBeUndefined()
    })
  })

  describe('stateOf', () => {
    it('reads each state from a row, with an entity ref winning over stale flags', () => {
      expect(stateOf(null)).toBe('unminted')
      expect(stateOf({ key: 'w1', work: id() })).toBe('active')
      expect(stateOf({ key: 'w1', work: id(), retired: true })).toBe('active')
      expect(stateOf({ key: 'w1', mergedInto: id(), retired: true })).toBe('alias')
      expect(stateOf({ key: 'w1', retired: true })).toBe('retired')
      // A bare key row, as rows looked before retiring kept names
      expect(stateOf({ key: 'w1' })).toBe('retired')
    })
  })

  describe('every creation path mints a nick before it returns', () => {
    const hasNick = async (type, entityId) => Boolean(await Nick.exists({ [type]: entityId }))

    it('notes made with POST /api/note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'Plain create' })
      expect(await hasNick('note', note._id)).toBe(true)
      const res = await agent.get(`/api/nick/note/${note._id}`).expect(200)
      expect(res.body.data.key).toMatch(/^n\d{6}$/)
    })

    it('notes from a bulk import for a work', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'W' })
      await agent.put(`/api/note/import/work/${work._id}`).send({ notesText: 'one\ntwo\n' }).expect(200)
      const notes = (await agent.get(`/api/work/${work._id}/notes`).expect(200)).body.data
      expect(notes).toHaveLength(2)
      for (const n of notes) expect(n.nick).toMatch(/^n\d{6}$/)
    })

    it('piles made from a note or a work, and plain works, ideas and piles', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'N' })
      const work = await createWork(agent, { name: 'W' })
      const fromNote = (await agent.put(`/api/note/${note._id}/pile/create`).send({ name: 'From note' }).expect(201)).body.data
      const fromWork = (await agent.put(`/api/work/${work._id}/pile/create`).send({ name: 'From work' }).expect(201)).body.data
      const pileIds = [...(fromNote.piles ?? []), ...(fromWork.piles ?? [])].map((p) => p._id ?? p)
      expect(pileIds).toHaveLength(2)
      for (const pid of pileIds) expect(await hasNick('pile', pid)).toBe(true)
      expect(await hasNick('work', work._id)).toBe(true)
      expect(await hasNick('idea', (await createIdea(agent))._id)).toBe(true)
      expect(await hasNick('pile', (await createPile(agent, 'P'))._id)).toBe(true)
    })

    it('a failed mint is logged and leaves the entity saved', async () => {
      const agent = await authedAgent()
      const spy = vi.spyOn(Nick, 'create').mockRejectedValueOnce(new Error('boom'))
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const note = await createNote(agent, { title: 'Still saved' })
        expect(note._id).toBeTruthy()
        expect(await hasNick('note', note._id)).toBe(false)
      } finally {
        spy.mockRestore()
        quiet.mockRestore()
      }
    })
  })

  describe('resolveNick', () => {
    it('reads a nick whose entity vanished without being retired as retired', async () => {
      const agent = await authedAgent()
      const work = await createWork(agent, { name: 'Vanished' })
      const { key } = await mintNick('work', work._id)
      // Deleted behind the lifecycle's back
      await mongoose.model('work').collection.deleteOne({ _id: new mongoose.Types.ObjectId(work._id) })
      expect(await resolveNick(key)).toMatchObject({ state: 'retired', key, type: 'work' })
      const res = await agent.get(`/api/nick/${key}`).expect(200)
      expect(res.body.data).toMatchObject({ state: 'retired', retired: true })
    })

    it('gives both lookups the same answer for a retired note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'Gone' })
      const { key } = await mintNick('note', note._id)
      await agent.delete(`/api/note/${note._id}`).expect(200)
      expect((await agent.get(`/api/nick/${key}`).expect(200)).body.data).toMatchObject({ state: 'retired', name: 'Gone' })
      expect((await agent.get(`/api/note/nick/${key}`).expect(200)).body.data).toEqual([])
    })

    it('answers null for a key never minted, or not a string', async () => {
      expect(await resolveNick('w000000')).toBeNull()
      expect(await resolveNick(undefined)).toBeNull()
    })
  })

  describe('retire and re-point', () => {
    it('re-points to the kept entity, and refuses to re-point to itself', async () => {
      const agent = await authedAgent()
      const a = await createWork(agent, { name: 'A' })
      const b = await createWork(agent, { name: 'B' })
      const { key } = await mintNick('work', a._id)
      await repointNick('work', a._id, b._id)
      expect(await resolveNick(key)).toMatchObject({ state: 'alias', id: b._id, mergedFrom: 'A' })
      await expect(repointNick('work', b._id, b._id)).rejects.toThrow(/own entity/)
    })

    it('does nothing for an entity that never had a nick', async () => {
      const lonely = id()
      await retireNick('work', lonely)
      await repointNick('work', lonely, id())
      expect(await Nick.countDocuments({})).toBe(0)
    })
  })
})
