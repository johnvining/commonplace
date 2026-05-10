import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { authedAgent, createNote } from './setup.js'

// Mock embeddings to avoid OpenAI on note updates
vi.mock('../src/utils/embeddings.js', async (orig) => {
  const actual = await orig()
  return { ...actual, embedNoteIfStale: vi.fn().mockResolvedValue(null) }
})

// Override config.imageStorePath to a tmp dir for isolation. Must run before
// any controller imports, so we mutate the singleton via a side-effect import.
let imageStoreRoot
beforeAll(async () => {
  imageStoreRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cpimg-'))
  const configMod = await import('../src/config/index.js')
  configMod.default.imageStorePath = imageStoreRoot
})

afterAll(async () => {
  if (imageStoreRoot) await fs.promises.rm(imageStoreRoot, { recursive: true, force: true })
})

describe('note images', () => {
  describe('PUT /api/note/:id/image (upload)', () => {
    it('attaches an uploaded image to the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const res = await agent
        .put(`/api/note/${note._id}/image`)
        .attach('image', Buffer.from('fake-jpg-bytes'), 'photo.jpg')
        .expect(200)
      expect(res.body.status).toBe(true)
      expect(res.body.data.newNote.images).toHaveLength(1)
      expect(res.body.data.newNote.images[0]).toMatch(/photo\.jpg$/)

      // file should exist on disk under the configured path
      const onDisk = path.join(imageStoreRoot, res.body.data.newNote.images[0])
      expect(fs.existsSync(onDisk)).toBe(true)
    })

    it('returns "No file" message when no upload sent', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const res = await agent.put(`/api/note/${note._id}/image`).expect(200)
      expect(res.body.status).toBe(false)
      expect(res.body.message).toMatch(/No file/)
    })
  })

  describe('GET /api/note/:id/images/:image', () => {
    it('returns the uploaded file content', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      await agent
        .put(`/api/note/${note._id}/image`)
        .attach('image', Buffer.from('hello-world-bytes'), 'a.jpg')
        .expect(200)
      const res = await agent.get(`/api/note/${note._id}/images/1`).expect(200)
      expect(res.body.toString()).toBe('hello-world-bytes')
    })
  })

  describe('DELETE /api/note/:id/image/', () => {
    it('removes an image from the note and disk', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const upload = await agent
        .put(`/api/note/${note._id}/image`)
        .attach('image', Buffer.from('bytes'), 'doomed.jpg')
        .expect(200)
      const filename = upload.body.data.newNote.images[0]
      const onDisk = path.join(imageStoreRoot, filename)
      expect(fs.existsSync(onDisk)).toBe(true)

      await agent
        .delete(`/api/note/${note._id}/image/`)
        .send({ filename })
        .expect(200)
      expect(fs.existsSync(onDisk)).toBe(false)

      const refreshed = await agent.get(`/api/note/${note._id}`).expect(200)
      expect(refreshed.body.data[0].images).not.toContain(filename)
    })

    it('returns 400 when the filename is not on the note', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      await agent
        .delete(`/api/note/${note._id}/image/`)
        .send({ filename: 'never-uploaded.jpg' })
        .expect(400)
    })
  })
})
