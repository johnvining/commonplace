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

  // A token for a real session of the signed-up user
  async function sessionToken(extra = {}) {
    const { default: User } = await import('../src/resources/user/user.model.js')
    if (!(await User.exists({}))) await authedAgent()
    const { default: Session } = await import('../src/resources/user/session.model.js')
    const user = await User.findOne({}).lean()
    const jti = 'test-' + Math.random()
    await Session.create({ _id: jti, user: user._id, expiresAt: new Date(Date.now() + 86400000) })
    return jwt.sign({ id: user._id, username: 'commonplace', ver: user.tokenVersion ?? 0, ...extra }, secret, { jwtid: jti })
  }

  it('lets a valid token through, re-issuing an old one', async () => {
    const fresh = await withToken(await sessionToken())
    expect(fresh.status).toBe(200)
    expect(fresh.headers['set-cookie']).toBeUndefined()

    const twoDaysAgo = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60
    const old = await withToken(await sessionToken({ iat: twoDaysAgo }))
    expect(old.status).toBe(200)
    expect(old.headers['set-cookie']?.[0]).toMatch(/^jwt=/)
  })

  describe('server-side sessions (#375)', () => {
    const cookieOf = (res) => res.headers['set-cookie'][0].split(';')[0].replace(/^jwt=/, '')
    const login = async () =>
      cookieOf(await (await api()).post('/api/user/auth').set('X-Requested-With', 'XMLHttpRequest')
        .send({ username: 'commonplace', password: 'testpass' }).expect(201))
    const logout = async (token, path = 'logout') =>
      (await api()).post(`/api/user/${path}`).set('X-Requested-With', 'XMLHttpRequest').set('Cookie', `jwt=${token}`).expect(200)

    it('rejects a validly signed token with no session behind it', async () => {
      await authedAgent()
      const res = await withToken(jwt.sign({ id: 'x', username: 'commonplace', ver: 0 }, secret))
      expect(res.status).toBe(401)
    })

    it('cuts off a token at logout, leaving other sessions signed in', async () => {
      await authedAgent()
      const phone = await login()
      const laptop = await login()
      await logout(phone)
      expect((await withToken(phone)).status).toBe(401)
      expect((await withToken(laptop)).status).toBe(200)
    })

    it('cuts off every token on logout everywhere', async () => {
      await authedAgent()
      const phone = await login()
      const laptop = await login()
      await logout(laptop, 'logout-everywhere')
      expect((await withToken(phone)).status).toBe(401)
      expect((await withToken(laptop)).status).toBe(401)
    })

    it('cuts off other tokens on a password change, keeping the changer signed in', async () => {
      await authedAgent()
      const other = await login()
      const res = await (await api()).put('/api/user/changepass').set('X-Requested-With', 'XMLHttpRequest')
        .send({ username: 'commonplace', oldPassword: 'testpass', newPassword: 'newpass' }).expect(201)
      expect((await withToken(other)).status).toBe(401)
      expect((await withToken(cookieOf(res))).status).toBe(200)
    })

    it('keeps registration closed after the only user is deleted', async () => {
      await authedAgent()
      const { default: User } = await import('../src/resources/user/user.model.js')
      await User.deleteMany({})
      await (await api()).put('/api/user/').set('X-Requested-With', 'XMLHttpRequest')
        .send({ username: 'commonplace', password: 'again' }).expect(401)
    })
  })

  it('leaves the login routes open', async () => {
    await (await api()).put('/api/user/').set('X-Requested-With', 'XMLHttpRequest').send({ username: 'commonplace', password: 'testpass' }).expect(201)
  })
})
