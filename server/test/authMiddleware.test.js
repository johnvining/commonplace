import { beforeAll, describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import { api, authedAgent } from './setup.js'

let secret
beforeAll(async () => {
  secret = (await import('../src/config/index.js')).default.secrets.jwt
})

const withToken = async (token) =>
  (await api()).get('/api/note/all/1').set('X-Requested-With', 'XMLHttpRequest').set('Cookie', `jwt=${token}`)

describe('auth middleware', () => {
  it('rejects a request without a token', async () => {
    const res = await (await api()).get('/api/note/all/1').set('X-Requested-With', 'XMLHttpRequest')
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Not authorized, token not available')
  })

  it('rejects a tampered, expired or wrong-user token', async () => {
    const good = jwt.sign({ id: 'x', username: 'commonplace' }, secret)
    for (const token of [
      good.slice(0, -2) + 'xx',
      jwt.sign({ id: 'x', username: 'commonplace' }, 'not-the-secret'),
      jwt.sign({ id: 'x', username: 'commonplace', exp: Math.floor(Date.now() / 1000) - 10 }, secret),
    ]) {
      const res = await withToken(token)
      expect(res.status).toBe(401)
      expect(res.body.message).toBe('Not authorized')
    }
    const wrongUser = await withToken(jwt.sign({ id: 'x', username: 'someone' }, secret))
    expect(wrongUser.status).toBe(401)
    expect(wrongUser.body.message).toBe('Wrong username')
  })

  it('lets a valid token through, re-issuing an old one', async () => {
    await authedAgent()
    const fresh = await withToken(jwt.sign({ id: 'x', username: 'commonplace' }, secret))
    expect(fresh.status).toBe(200)
    expect(fresh.headers['set-cookie']).toBeUndefined()

    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60
    const old = await withToken(jwt.sign({ id: 'x', username: 'commonplace', iat: twoDaysAgo }, secret))
    expect(old.status).toBe(200)
    expect(old.headers['set-cookie']?.[0]).toMatch(/^jwt=/)
  })

  it('leaves the login routes open', async () => {
    await (await api()).put('/api/user/').set('X-Requested-With', 'XMLHttpRequest').send({ username: 'commonplace', password: 'testpass' }).expect(201)
  })
})
