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

    it('keeps the file name and extension intact', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'X' })
      const stored = []
      for (const name of ['kids.jpeg', 'Free Drivers German.jpeg', 'scan.v2.png']) {
        const res = await agent.put(`/api/note/${note._id}/image`).attach('image', Buffer.from('x'), name).expect(200)
        stored.push(res.body.data.newNote.images.at(-1).split('/')[1])
      }
      expect(stored).toEqual(['1-kids.jpeg', '2-Free_Drivers_German.jpeg', '3-scan.v2.png'])
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

  describe('DELETE /api/note/:id (image cleanup)', () => {
    const upload = (agent, id, name) =>
      agent.put(`/api/note/${id}/image`).attach('image', Buffer.from('bytes-' + name), name).expect(200)

    it("removes the note's image files and its image directory", async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'doomed' })
      await upload(agent, note._id, 'one.jpg')
      const res = await upload(agent, note._id, 'two.jpg')
      const files = res.body.data.newNote.images.map(f => path.join(imageStoreRoot, f))
      const dir = path.join(imageStoreRoot, String(note._id))
      // A file in the note's directory that the note no longer lists
      // (e.g. an upload whose DB update failed) must go too.
      await fs.promises.writeFile(path.join(dir, 'stray.jpg'), 'stray')
      files.forEach(f => expect(fs.existsSync(f)).toBe(true))

      await agent.delete(`/api/note/${note._id}`).expect(200)

      files.forEach(f => expect(fs.existsSync(f)).toBe(false))
      expect(fs.existsSync(dir)).toBe(false)
      expect(fs.existsSync(imageStoreRoot)).toBe(true)
    })

    it("leaves other notes' images alone", async () => {
      const agent = await authedAgent()
      const doomed = await createNote(agent, { title: 'doomed' })
      const kept = await createNote(agent, { title: 'kept' })
      await upload(agent, doomed._id, 'a.jpg')
      const keptRes = await upload(agent, kept._id, 'b.jpg')
      const keptFile = path.join(imageStoreRoot, keptRes.body.data.newNote.images[0])

      await agent.delete(`/api/note/${doomed._id}`).expect(200)

      expect(fs.existsSync(keptFile)).toBe(true)
      const img = await agent.get(`/api/note/${kept._id}/images/1`).expect(200)
      expect(img.body.toString()).toBe('bytes-b.jpg')
    })

    it('deletes a note that never had images', async () => {
      const agent = await authedAgent()
      const note = await createNote(agent, { title: 'plain' })
      await agent.delete(`/api/note/${note._id}`).expect(200)
      await agent.get(`/api/note/${note._id}`).expect(200).then(r => expect(r.body.data).toHaveLength(0))
    })

    it('never removes a directory named by an id that matches no note', async () => {
      const agent = await authedAgent()
      // Mongoose treats any 12-character string as a valid ObjectId, so the
      // directory to remove must come from the stored note, not the URL.
      for (const id of ['aaaaaaaaaaaa', '507f1f77bcf86cd799439011']) {
        const dir = path.join(imageStoreRoot, id)
        await fs.promises.mkdir(dir, { recursive: true })
        await fs.promises.writeFile(path.join(dir, 'keep.jpg'), 'keep')
        await agent.delete(`/api/note/${id}`)
        expect(fs.existsSync(path.join(dir, 'keep.jpg')), id).toBe(true)
      }
    })

    it('rejects ids that are not ObjectIds', async () => {
      const agent = await authedAgent()
      await agent.delete('/api/note/not-an-id').expect(400)
    })
  })
})
