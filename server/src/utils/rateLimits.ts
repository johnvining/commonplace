import rateLimit from 'express-rate-limit'
import type { RequestHandler } from 'express'

const noopLimiter: RequestHandler = (_req, _res, next) => next()
const isTest = !!process.env.VITEST

// Brute-force protection on auth endpoints. 10 attempts per 15 min per IP is
// enough headroom for an honest user fat-fingering passwords; bots get cut off
// well before they can sweep a dictionary.
export const authRateLimiter: RequestHandler = isTest
  ? noopLimiter
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many auth attempts. Try again later.' },
    })

// Expensive endpoints that touch OpenAI. The user wallet is the real damage
// surface — a runaway client could burn hundreds of dollars in seconds via
// bulk-embed / bulk-ocr / unified-search.
export const expensiveRateLimiter: RequestHandler = isTest
  ? noopLimiter
  : rateLimit({
      windowMs: 60 * 1000,
      max: 30,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: 'Too many requests. Slow down.' },
    })
