import { describe, expect, it } from 'vitest'
import { api, authedAgent } from './setup.js'

describe('smoke', () => {
  it('rejects unauthenticated /api/note request', async () => {
    const res = await (await api()).get('/api/note').expect(401)
    expect(res.body.message).toMatch(/not authorized/i)
  })

  it('allows authenticated /api/user/me request after registration', async () => {
    const agent = await authedAgent()
    const res = await agent.get('/api/user/me').expect(200)
    expect(res.body).toBeDefined()
  })
})
