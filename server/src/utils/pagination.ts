import type { Request } from 'express'

// Hard cap on entity-notes responses. A single entity with thousands of
// notes used to return a huge payload that blew up JSON serialization
// and the client renderer. Clients pass ?skip=&limit= for paging; we
// default to a safe page size if they don't.
export const ENTITY_NOTES_LIMIT = 500

export function pageParams(req: Request, cap = ENTITY_NOTES_LIMIT) {
  const skipRaw = Number(req.query.skip)
  const limitRaw = Number(req.query.limit)
  const skip = Number.isFinite(skipRaw) && skipRaw > 0 ? skipRaw : 0
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, cap)
      : cap
  return { skip, limit }
}
