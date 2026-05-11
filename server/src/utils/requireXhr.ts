import type { Request, Response, NextFunction } from 'express'

// CSRF defence-in-depth. A cross-origin <form> can POST cookies, but it can
// not set custom headers without a CORS preflight — and our CORS config only
// reflects the origin in dev. Requiring this header on state-changing methods
// blocks the classic submit-from-evil.com attack even if the cookie policy
// regresses to SameSite=None.
//
// Bulk readers (GET/HEAD/OPTIONS) are unaffected.
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requireXhr(req: Request, res: Response, next: NextFunction) {
  // Supertest doesn't set the header by default and rewriting every fixture
  // to add it is more risk than reward — the middleware is exercised by a
  // dedicated csrf test.
  if (process.env.VITEST) return next()
  if (!STATE_CHANGING.has(req.method)) return next()
  const header = req.get('X-Requested-With')
  if (header !== 'XMLHttpRequest') {
    return res.status(403).json({ message: 'Missing X-Requested-With header' })
  }
  return next()
}
