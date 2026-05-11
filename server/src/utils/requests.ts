import type { Request, Response, RequestHandler } from 'express'
import { MongooseError } from 'mongoose'

type AsyncHandler = (req: Request, res: Response) => Promise<unknown>

// Mongoose duplicate-key errors aren't a subclass of MongooseError — they
// surface as a raw MongoServerError with code 11000. Detect via duck typing
// rather than importing yet another error class.
type MongoLikeError = Error & { code?: number; name?: string }

function classify(err: unknown): { status: number; message: string } {
  if (err instanceof MongooseError) {
    if (err.name === 'CastError') return { status: 400, message: 'Invalid id' }
    if (err.name === 'ValidationError') return { status: 400, message: err.message }
    if (err.name === 'DocumentNotFoundError') return { status: 404, message: 'Not found' }
  }
  const e = err as MongoLikeError | undefined
  if (e?.code === 11000) return { status: 409, message: 'Duplicate' }
  return { status: 500, message: 'Internal error' }
}

export const asyncWrapper = (
  requestHandler: AsyncHandler,
  successCode: number
): RequestHandler => {
  return async function (req, res) {
    try {
      const data = await requestHandler(req, res)
      if (res.headersSent) return
      res.status(successCode).json({ data: data })
    } catch (e) {
      const { status, message } = classify(e)
      // Log with request context so a failure isn't a naked stack trace.
      // Skip in tests — vitest already prints assertion context and the
      // server logs add noise that obscures real failures.
      if (!process.env.VITEST) {
        console.error(`[${req.method} ${req.originalUrl}]`, e)
      }
      if (res.headersSent) return
      res.status(status).json({ message })
    }
  }
}
