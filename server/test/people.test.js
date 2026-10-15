import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createAuthor, createIdea, createNote } from './setup.js'

// Keep note updates off OpenAI.
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

const getNote = async (agent, id) => (await agent.get(`/api/note/${id}`).expect(200)).body.data[0]

describe('people on notes', () => {
  it('tags a note with people, separately from its authors', async () => {
    const agent = await authedAgent()
    const writer = await createAuthor(agent, 'Plutarch')
    const subject = await createAuthor(agent, 'Alexander')
    const note = await createNote(agent, { title: 'Life of Alexander' })
    await agent.put(`/api/note/${note._id}`).send({ authors: [writer._id], people: [subject._id] }).expect(200)
    const saved = await getNote(agent, note._id)
    expect(saved.authors.map(a => a.name)).toEqual(['Plutarch'])
    expect(saved.people.map(p => p.name)).toEqual(['Alexander'])
  })

  it("lists the notes about a person, not the ones they wrote", async () => {
    const agent = await authedAgent()
    const person = await createAuthor(agent, 'Alexander')
    const about = await createNote(agent, { title: 'About Alexander' })
    const by = await createNote(agent, { title: 'By Alexander' })
    await agent.put(`/api/note/${about._id}`).send({ people: [person._id] }).expect(200)
    await agent.put(`/api/note/${by._id}`).send({ authors: [person._id] }).expect(200)
    const res = await agent.get(`/api/auth/${person._id}/notes-about`).expect(200)
    expect(res.body.data.map(n => n.title)).toEqual(['About Alexander'])
    expect(res.headers['x-total-count']).toBe('1')
  })

  it('removes a deleted author from the notes about them', async () => {
    const agent = await authedAgent()
    const doomed = await createAuthor(agent, 'Doomed')
    const kept = await createAuthor(agent, 'Kept')
    const note = await createNote(agent, { title: 'N' })
    await agent.put(`/api/note/${note._id}`).send({ people: [doomed._id, kept._id] }).expect(200)
    await agent.delete(`/api/auth/${doomed._id}/delete`).expect(204)
    expect((await getNote(agent, note._id)).people.map(p => p.name)).toEqual(['Kept'])
  })
})
