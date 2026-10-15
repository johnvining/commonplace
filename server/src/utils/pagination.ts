import type { Request, Response } from 'express'
import Note from '../resources/note/note.model.js'
import { findNotesAndPopulate } from '../resources/note/note.controllers.js'

// Hard cap on entity-notes responses. A single entity with thousands of
// notes used to return a huge payload that blew up JSON serialization
// and the client renderer. Clients pass ?skip=&limit= for paging; we
// default to a safe page size if they don't.
export const ENTITY_NOTES_LIMIT = 500

// Response header carrying the full match count, so clients can tell
// whether more pages exist beyond the one they received.
export const TOTAL_COUNT_HEADER = 'X-Total-Count'

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

// One page of notes matching `query`, with the total count in the
// X-Total-Count header. `_id` is appended to the sort as a tiebreaker:
// bulk imports give many notes the same updatedAt, and without a total
// order skip/limit can repeat or drop notes across page boundaries.
export async function findEntityNotesPage(
  req: Request,
  res: Response,
  query: any,
  sort: Record<string, 1 | -1>
) {
  const { skip, limit } = pageParams(req)
  const tiebreak = sort._id ? {} : { _id: (Object.values(sort)[0] ?? 1) as 1 | -1 }
  const [notes, total] = await Promise.all([
    findNotesAndPopulate(query, { ...sort, ...tiebreak }, false, skip, limit),
    Note.countDocuments(query),
  ])
  res.set(TOTAL_COUNT_HEADER, String(total))
  return notes
}
