import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { authedAgent, createNote } from './setup.js'

// OCR returns "text of <file>" so tests can see which images were read.
// Stored files get an id prefix (#368); leave it out.
const fileOf = (location) => path.basename(location).replace(/^[0-9a-f]{24}-/, '')
const ocrCalls = []
let ocrImpl = async (location) => `text of ${fileOf(location)}`
vi.mock('../src/utils/suggestions.js', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    getOpenAiOCR: vi.fn(async (location) => {
      ocrCalls.push(fileOf(location))
      return ocrImpl(location)
    }),
  }
})
// Keep embeddings off OpenAI.
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

let imageStoreRoot
let config
beforeAll(async () => {
  imageStoreRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cpocr-'))
  config = (await import('../src/config/index.js')).default
  config.imageStorePath = imageStoreRoot
  config.secrets.openaikey = 'test-key'
})
afterAll(async () => {
  if (imageStoreRoot) await fs.promises.rm(imageStoreRoot, { recursive: true, force: true })
})
beforeEach(() => {
  ocrCalls.length = 0
  ocrImpl = async (location) => `text of ${fileOf(location)}`
  config.secrets.openaikey = 'test-key'
})

const upload = (agent, id, name) =>
  agent.put(`/api/note/${id}/image`).attach('image', Buffer.from('img'), name).expect(200)
const getNote = async (agent, id) => (await agent.get(`/api/note/${id}`).expect(200)).body.data[0]

describe('auto OCR on image upload', () => {
  it('fills a blank note with the text of its first image', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'photo' })
    const res = await upload(agent, note._id, 'page.jpg')
    expect(res.body.data.newNote.text).toBe('text of page.jpg')
    expect((await getNote(agent, note._id)).text).toBe('text of page.jpg')
  })

  it('appends later images, reading only the new one', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'two pages' })
    await upload(agent, note._id, 'a.jpg')
    ocrCalls.length = 0
    const res = await upload(agent, note._id, 'b.jpg')
    expect(ocrCalls).toEqual(['b.jpg'])
    expect(res.body.data.newNote.text).toBe('text of a.jpg\n\ntext of b.jpg')
  })

  it('leaves text the user wrote alone', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'typed', text: 'my own words' })
    await upload(agent, note._id, 'a.jpg')
    expect(ocrCalls).toEqual([])
    expect((await getNote(agent, note._id)).text).toBe('my own words')
  })

  it('stops extending once the user edits the OCR text', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'edited' })
    await upload(agent, note._id, 'a.jpg')
    await agent.put(`/api/note/${note._id}`).send({ text: 'text of a.jpg, fixed by hand' }).expect(200)
    ocrCalls.length = 0
    await upload(agent, note._id, 'b.jpg')
    expect(ocrCalls).toEqual([])
    expect((await getNote(agent, note._id)).text).toBe('text of a.jpg, fixed by hand')
  })

  it('builds on OCR text the embedding job already stored', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'old photo' })
    const Note = (await import('../src/resources/note/note.model.js')).default
    await Note.updateOne({ _id: note._id }, { $set: { images: ['x/0-old.jpg'], ocrText: 'earlier ocr' } })
    const res = await upload(agent, note._id, 'new.jpg')
    expect(ocrCalls).toEqual(['new.jpg'])
    expect(res.body.data.newNote.text).toBe('earlier ocr\n\ntext of new.jpg')
  })

  it('still uploads when OCR fails', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'flaky' })
    ocrImpl = async () => { throw new Error('OpenAI is down') }
    const res = await upload(agent, note._id, 'a.jpg')
    expect(res.body.status).toBe(true)
    expect(res.body.data.newNote.images).toHaveLength(1)
    expect((await getNote(agent, note._id)).text ?? '').toBe('')
  })

  it('skips OCR when no OpenAI key is configured', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'no key' })
    config.secrets.openaikey = ''
    await upload(agent, note._id, 'a.jpg')
    expect(ocrCalls).toEqual([])
  })

  it('does not overwrite text saved while OCR was running', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'race' })
    ocrImpl = async (location) => {
      await agent.put(`/api/note/${note._id}`).send({ text: 'typed during OCR' }).expect(200)
      return `text of ${fileOf(location)}`
    }
    await upload(agent, note._id, 'a.jpg')
    expect((await getNote(agent, note._id)).text).toBe('typed during OCR')
  })
})

describe('text source (#379)', () => {
  const Note = async () => (await import('../src/resources/note/note.model.js')).default
  const source = async (id) => (await (await Note()).findById(id).lean()).textSource

  it('records OCR text as ocr and typed text as user, on every kind of write', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N' })
    await upload(agent, note._id, 'a.jpg')
    expect(await source(note._id)).toBe('ocr')
    await agent.put(`/api/note/${note._id}`).send({ text: 'typed' }).expect(200)
    expect(await source(note._id)).toBe('user')
    await agent.put(`/api/note/${note._id}`).send({ text: '  ' }).expect(200)
    expect(await source(note._id)).toBe('blank')
    const typed = await createNote(agent, { title: 'T', text: 'from the start' })
    expect(await source(typed._id)).toBe('user')
    await (await Note()).updateMany({ _id: typed._id }, { $set: { text: '' } })
    expect(await source(typed._id)).toBe('blank')
  })

  it('keeps OCR text OCR\'s when a save sends it back unchanged', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N' })
    await upload(agent, note._id, 'a.jpg')
    // The editor sends the text back with every save, e.g. a title fix
    await agent.put(`/api/note/${note._id}`).send({ title: 'Fixed', text: 'text of a.jpg' }).expect(200)
    expect(await source(note._id)).toBe('ocr')
    const res = await upload(agent, note._id, 'b.jpg')
    expect(res.body.data.newNote.text).toBe('text of a.jpg\n\ntext of b.jpg')
  })

  it('stops OCR once the user has edited the text', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N' })
    await upload(agent, note._id, 'a.jpg')
    await agent.put(`/api/note/${note._id}`).send({ text: 'text of a.jpg, edited' }).expect(200)
    expect(await source(note._id)).toBe('user')
    ocrCalls.length = 0
    await upload(agent, note._id, 'b.jpg')
    expect(ocrCalls).toEqual([])
    expect((await getNote(agent, note._id)).text).toBe('text of a.jpg, edited')
  })

  it('lets bulk OCR text grow with later uploads', async () => {
    const agent = await authedAgent()
    const note = await createNote(agent, { title: 'N' })
    await (await Note()).collection.updateOne(
      { _id: new (await import('mongoose')).default.Types.ObjectId(note._id) },
      { $set: { images: ['x/old.jpg'] } }
    )
    const bulk = await agent.post('/api/note/bulk-ocr').send({ noteIds: [note._id] }).expect(200)
    expect(bulk.body.data[0]).toMatchObject({ textUpdated: true, ocrText: 'text of old.jpg' })
    expect(await source(note._id)).toBe('ocr')
    const res = await upload(agent, note._id, 'new.jpg')
    expect(res.body.data.newNote.text).toBe('text of old.jpg\n\ntext of new.jpg')
  })

  it('reads notes saved before the field existed by the old rule', async () => {
    const { textSourceOf } = await import('../src/utils/noteText.js')
    expect(textSourceOf({ text: '' })).toBe('blank')
    expect(textSourceOf({ text: 'same', ocrText: 'same' })).toBe('ocr')
    expect(textSourceOf({ text: 'mine', ocrText: 'other' })).toBe('user')
    expect(textSourceOf({ text: 'same', ocrText: 'same', textSource: 'user' })).toBe('user')
  })
})
