import { describe, expect, it, vi } from 'vitest'
import { authedAgent, createNote, createWork } from './setup.js'
import Note from '../src/resources/note/note.model.js'
import Work from '../src/resources/work/work.model.js'

vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

const note = (id) => Note.findById(id).lean()
const work = (id) => Work.findById(id).lean()

describe('values filled in from a URL (#377)', () => {
  it('fills an empty year from the URL, once', async () => {
    const agent = await authedAgent()
    const n = await createNote(agent, { title: 'N' })
    await agent.put(`/api/note/${n._id}`).send({ url: 'https://example.com/2018/04/post' }).expect(200)
    expect((await note(n._id)).year).toBe(2018)
    // Now an ordinary value: a new URL leaves it alone
    await agent.put(`/api/note/${n._id}`).send({ url: 'https://example.com/2021/01/other' }).expect(200)
    expect((await note(n._id)).year).toBe(2018)
  })

  it('never replaces a year, whether stored or sent with the URL', async () => {
    const agent = await authedAgent()
    const n = await createNote(agent, { title: 'N' })
    await agent.put(`/api/note/${n._id}`).send({ year: 1999 }).expect(200)
    // An update that doesn't mention the year keeps the stored one
    await agent.put(`/api/note/${n._id}`).send({ url: 'https://example.com/2018/04/post' }).expect(200)
    expect((await note(n._id)).year).toBe(1999)
    // One sent alongside the URL wins too
    await agent.put(`/api/note/${n._id}`).send({ year: 2005, url: 'https://example.com/2019/04/post' }).expect(200)
    expect((await note(n._id)).year).toBe(2005)
  })

  it('gives a work with no URL the one site its notes are on, and never replaces it', async () => {
    const agent = await authedAgent()
    const w = await createWork(agent, { name: 'W' })
    const a = await createNote(agent, { title: 'A', work: w._id })
    await agent.put(`/api/note/${a._id}`).send({ url: 'https://site.example/a' }).expect(200)
    expect((await work(w._id)).url).toBe('https://site.example')
    // Already set: a note on another site changes nothing
    const b = await createNote(agent, { title: 'B', work: w._id })
    await agent.put(`/api/note/${b._id}`).send({ url: 'https://other.example/b' }).expect(200)
    expect((await work(w._id)).url).toBe('https://site.example')
  })

  it('leaves a work without a URL when its notes are on different sites', async () => {
    const agent = await authedAgent()
    const w = await createWork(agent, { name: 'W' })
    const a = await createNote(agent, { title: 'A', work: w._id, url: 'https://one.example/a' })
    const b = await createNote(agent, { title: 'B', work: w._id })
    await agent.put(`/api/note/${b._id}`).send({ url: 'https://two.example/b' }).expect(200)
    expect((await work(w._id)).url).toBeUndefined()
    expect(a).toBeTruthy()
  })

  it('imports with the same rule: the year cell wins, else the URL', async () => {
    const agent = await authedAgent()
    const csv = [
      'A,Cell wins,text,W,https://example.com/2018/01/a,,,,1999,,',
      'B,From URL,text,W,https://example.com/2018/01/b,,,,,,',
    ].join('\n')
    await agent.put('/api/note/import/csv').send({ importList: csv }).expect(200)
    const byTitle = Object.fromEntries((await Note.find({}).lean()).map((n) => [n.title, n]))
    expect(byTitle['Cell wins'].year).toBe(1999)
    expect(byTitle['From URL'].year).toBe(2018)
  })
})
