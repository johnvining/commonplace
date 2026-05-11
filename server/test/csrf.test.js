import { describe, it, expect } from 'vitest'
import { requireXhr } from '../src/utils/requireXhr.js'

// requireXhr short-circuits under VITEST=true so the rest of the suite can
// use plain supertest agents. These tests reach in and call the middleware
// after unsetting VITEST, so the real branch is exercised.
function exercise({ method, header }) {
  const prev = process.env.VITEST
  delete process.env.VITEST
  try {
    let status = 200
    let body = null
    let nextCalled = false
    const req = { method, get: name => (name === 'X-Requested-With' ? header : undefined) }
    const res = {
      status(s) {
        status = s
        return this
      },
      json(b) {
        body = b
        return this
      },
    }
    requireXhr(req, res, () => {
      nextCalled = true
    })
    return { status, body, nextCalled }
  } finally {
    if (prev !== undefined) process.env.VITEST = prev
  }
}

describe('requireXhr', () => {
  it('rejects POST without X-Requested-With', () => {
    const { status, body, nextCalled } = exercise({ method: 'POST' })
    expect(nextCalled).toBe(false)
    expect(status).toBe(403)
    expect(body).toEqual({ message: 'Missing X-Requested-With header' })
  })

  it('allows POST with X-Requested-With: XMLHttpRequest', () => {
    const { nextCalled } = exercise({ method: 'POST', header: 'XMLHttpRequest' })
    expect(nextCalled).toBe(true)
  })

  it('rejects PUT/PATCH/DELETE without the header', () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const { status, nextCalled } = exercise({ method })
      expect(nextCalled, method).toBe(false)
      expect(status, method).toBe(403)
    }
  })

  it('allows GET/HEAD/OPTIONS through without the header', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      const { nextCalled } = exercise({ method })
      expect(nextCalled, method).toBe(true)
    }
  })
})
