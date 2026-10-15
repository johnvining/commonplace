import { describe, expect, it } from 'vitest'
import { authedAgent, createNote, createWork } from './setup.js'

describe('open counts', () => {
  for (const [type, create] of [['note', (a) => createNote(a, { title: 'N' })], ['work', (a) => createWork(a, { name: 'W' })]]) {
    it(`counts opens of a ${type} without touching updatedAt`, async () => {
      const agent = await authedAgent()
      const doc = await create(agent)
      const get = async () => {
        const body = (await agent.get(`/api/${type}/${doc._id}`).expect(200)).body.data
        return Array.isArray(body) ? body[0] : body
      }
      const before = await get()
      expect(before.openCount ?? 0).toBe(0)
      for (let i = 1; i <= 3; i++) {
        const res = await agent.post(`/api/${type}/${doc._id}/opened`).expect(200)
        expect(res.body.data.openCount).toBe(i)
      }
      const after = await get()
      expect(after.openCount).toBe(3)
      expect(after.lastOpenedAt).toBeTruthy()
      expect(after.updatedAt).toBe(before.updatedAt)
    })

    it(`rejects unknown ids and client-set counts for ${type}s`, async () => {
      const agent = await authedAgent()
      await agent.post(`/api/${type}/507f1f77bcf86cd799439011/opened`).expect(404)
      await agent.post(`/api/${type}/not-an-id/opened`).expect(400)
      const doc = await create(agent)
      await agent.put(`/api/${type}/${doc._id}`).send({ openCount: 99 }).expect(400)
    })
  }
})
