import { describe, expect, it } from 'vitest'
import { api, authedAgent } from './setup.js'

describe('user', () => {
  describe('PUT /api/user/ (register)', () => {
    it('registers the singleton commonplace user', async () => {
      const res = await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'pw1' })
        .expect(201)
      expect(res.body.user).toBeDefined()
      expect(res.headers['set-cookie']?.[0]).toMatch(/jwt=/)
    })

    it('rejects non-commonplace usernames', async () => {
      const res = await (await api())
        .put('/api/user/')
        .send({ username: 'someoneelse', password: 'pw1' })
        .expect(400)
      expect(res.body.message).toMatch(/Username or Password/)
    })

    it('rejects when password missing', async () => {
      await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace' })
        .expect(400)
    })

    it('rejects duplicate registration', async () => {
      await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'pw1' })
        .expect(201)
      const res = await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'pw1' })
        .expect(401)
      expect(res.body.message).toMatch(/already exists/)
    })
  })

  describe('POST /api/user/auth (login)', () => {
    it('logs in with correct credentials', async () => {
      await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'pw1' })
        .expect(201)
      const res = await (await api())
        .post('/api/user/auth')
        .send({ username: 'commonplace', password: 'pw1' })
        .expect(201)
      expect(res.headers['set-cookie']?.[0]).toMatch(/jwt=/)
    })

    it('rejects with wrong password', async () => {
      await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'pw1' })
        .expect(201)
      const res = await (await api())
        .post('/api/user/auth')
        .send({ username: 'commonplace', password: 'wrong' })
        .expect(400)
      expect(res.body.message).toMatch(/Incorrect/)
    })

    it('rejects with unknown username', async () => {
      const res = await (await api())
        .post('/api/user/auth')
        .send({ username: 'commonplace', password: 'pw1' })
        .expect(400)
      expect(res.body.error || res.body.message).toMatch(/User not found|Login/)
    })

    it('rejects with missing fields', async () => {
      await (await api())
        .post('/api/user/auth')
        .send({})
        .expect(400)
    })
  })

  describe('GET /api/user/me', () => {
    it('returns 401 without cookie', async () => {
      await (await api()).get('/api/user/me').expect(401)
    })

    it('returns 200 when authed', async () => {
      const agent = await authedAgent()
      await agent.get('/api/user/me').expect(200)
    })
  })

  describe('POST /api/user/logout', () => {
    it('clears jwt and returns 200', async () => {
      const agent = await authedAgent()
      const res = await agent.post('/api/user/logout').expect(200)
      const setCookie = res.headers['set-cookie']?.[0] || ''
      // After logout cookie should be cleared
      expect(setCookie).toMatch(/jwt=/)
      // Subsequent /me should fail
      await agent.get('/api/user/me').expect(401)
    })

    it('returns 401 without auth', async () => {
      await (await api()).post('/api/user/logout').expect(401)
    })
  })

  describe('PUT /api/user/changepass', () => {
    it('changes password with correct old password', async () => {
      await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'old' })
        .expect(201)
      await (await api())
        .put('/api/user/changepass')
        .send({ username: 'commonplace', oldPassword: 'old', newPassword: 'new' })
        .expect(201)
      // Login with new password should work
      await (await api())
        .post('/api/user/auth')
        .send({ username: 'commonplace', password: 'new' })
        .expect(201)
      // Login with old password should fail
      await (await api())
        .post('/api/user/auth')
        .send({ username: 'commonplace', password: 'old' })
        .expect(400)
    })

    it('rejects with wrong old password', async () => {
      await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'old' })
        .expect(201)
      await (await api())
        .put('/api/user/changepass')
        .send({ username: 'commonplace', oldPassword: 'wrong', newPassword: 'new' })
        .expect(400)
    })

    it('rejects when missing fields', async () => {
      await (await api())
        .put('/api/user/')
        .send({ username: 'commonplace', password: 'old' })
        .expect(201)
      await (await api())
        .put('/api/user/changepass')
        .send({ username: 'commonplace', oldPassword: 'old' })
        .expect(400)
    })

    it('rejects when user does not exist', async () => {
      await (await api())
        .put('/api/user/changepass')
        .send({ username: 'commonplace', oldPassword: 'old', newPassword: 'new' })
        .expect(400)
    })
  })
})
