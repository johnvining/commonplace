import { describe, expect, it } from 'vitest'
import { authedAgent, createIdea, createPile } from './setup.js'

describe('overview text on ideas and piles', () => {
  for (const [type, create] of [['idea', createIdea], ['pile', createPile]]) {
    it(`saves and returns a ${type}'s overview text`, async () => {
      const agent = await authedAgent()
      const doc = await create(agent, 'Stoicism')
      const text = 'Founded by **Zeno**.\n\nSee also Epicureanism.'
      await agent.put(`/api/${type}/${doc._id}`).send({ text }).expect(200)
      const res = await agent.get(`/api/${type}/${doc._id}`).expect(200)
      expect(res.body.data.text).toBe(text)
      expect(res.body.data.name).toBe('Stoicism')
    })
  }
})
