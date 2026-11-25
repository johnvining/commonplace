import { isValidObjectId } from 'mongoose'
import TimeEntry, { TIME_KINDS } from './time.model.js'
import type { Request } from 'express'

const DAY_MS = 24 * 60 * 60 * 1000

// 'YYYY-MM-DD' → that day at UTC midnight, or null when unparseable.
export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(value + 'T00:00:00.000Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export function dayString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayRange(day: Date) {
  return { start: day, end: new Date(day.getTime() + DAY_MS) }
}

// Monday–Sunday week containing `day` (UTC).
export function weekRange(day: Date) {
  // getUTCDay: 0 = Sunday … 6 = Saturday. Monday starts the week.
  const offset = (day.getUTCDay() + 6) % 7
  const start = new Date(day.getTime() - offset * DAY_MS)
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) }
}

function invalid(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 })
}

// Shared create/update validation. An entry needs a title, a pile, or both;
// kind must be reading|writing; minutes a positive whole number of minutes;
// date a YYYY-MM-DD day (defaults to today on create).
function toEntryBody(body: any, isCreate: boolean) {
  const out: Record<string, unknown> = {}

  if (body.title !== undefined || isCreate) {
    out.title = typeof body.title === 'string' ? body.title.trim() : ''
  }
  if (body.notes !== undefined || isCreate) {
    out.notes = typeof body.notes === 'string' ? body.notes : ''
  }

  if (body.pile !== undefined) {
    if (body.pile === null || body.pile === '') {
      out.pile = null
    } else if (typeof body.pile === 'string' && isValidObjectId(body.pile)) {
      out.pile = body.pile
    } else {
      throw invalid('Invalid pile')
    }
  } else if (isCreate) {
    out.pile = null
  }

  if (body.kind !== undefined || isCreate) {
    if (!TIME_KINDS.includes(body.kind)) throw invalid('Kind must be reading or writing')
    out.kind = body.kind
  }

  if (body.minutes !== undefined || isCreate) {
    const minutes = Number(body.minutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      throw invalid('Minutes must be a whole number between 1 and 1440')
    }
    out.minutes = minutes
  }

  if (body.date !== undefined || isCreate) {
    const day = body.date === undefined ? new Date() : parseDay(body.date)
    if (!day) throw invalid('Date must be YYYY-MM-DD')
    out.date = day
  }

  const title = (out.title ?? body.title ?? '') as string
  const pile = out.pile ?? body.pile
  if (isCreate && !String(title).trim() && !pile) {
    throw invalid('Give the entry a title or a pile')
  }
  return out
}

type PopulatedEntry = {
  pile?: { _id?: unknown; name?: string } | null
  title?: string
  kind: string
  minutes: number
}

type SubjectRow = {
  minutes: number
  readingMinutes: number
  writingMinutes: number
  entryCount: number
}

function addKind(row: SubjectRow, kind: string, minutes: number) {
  if (kind === 'reading') row.readingMinutes += minutes
  else if (kind === 'writing') row.writingMinutes += minutes
}

function summarize(entries: PopulatedEntry[]) {
  let readingMinutes = 0
  let writingMinutes = 0
  const pileMap = new Map<string, SubjectRow & { pile: string; name: string }>()
  const titleMap = new Map<string, SubjectRow & { title: string }>()
  for (const e of entries) {
    if (e.kind === 'reading') readingMinutes += e.minutes
    else if (e.kind === 'writing') writingMinutes += e.minutes
    const pileId = e.pile?._id ? String(e.pile._id) : null
    if (pileId) {
      const name = e.pile?.name ?? 'Unknown pile'
      const row = pileMap.get(pileId) ?? {
        pile: pileId,
        name,
        minutes: 0,
        readingMinutes: 0,
        writingMinutes: 0,
        entryCount: 0,
      }
      row.minutes += e.minutes
      row.entryCount += 1
      addKind(row, e.kind, e.minutes)
      pileMap.set(pileId, row)
    } else {
      const title = (e.title ?? '').trim() || 'Untitled'
      const row = titleMap.get(title) ?? {
        title,
        minutes: 0,
        readingMinutes: 0,
        writingMinutes: 0,
        entryCount: 0,
      }
      row.minutes += e.minutes
      row.entryCount += 1
      addKind(row, e.kind, e.minutes)
      titleMap.set(title, row)
    }
  }
  const byPile = [...pileMap.values()].sort((a, b) => b.minutes - a.minutes)
  const byTitle = [...titleMap.values()].sort((a, b) => b.minutes - a.minutes)
  return {
    totalMinutes: readingMinutes + writingMinutes,
    readingMinutes,
    writingMinutes,
    entryCount: entries.length,
    byPile,
    byTitle,
  }
}

export const reqCreateTimeEntry = async (req: Request) => {
  const doc = await TimeEntry.create(toEntryBody(req.body ?? {}, true))
  return TimeEntry.findById(doc._id).populate('pile', 'name').lean().exec()
}

export const reqListTimeEntries = async (req: Request) => {
  const filter: Record<string, unknown> = {}
  if (req.query.from || req.query.to) {
    const range: Record<string, Date> = {}
    if (req.query.from) {
      const from = parseDay(req.query.from)
      if (!from) throw invalid('From must be YYYY-MM-DD')
      range.$gte = from
    }
    if (req.query.to) {
      const to = parseDay(req.query.to)
      if (!to) throw invalid('To must be YYYY-MM-DD')
      range.$lte = new Date(to.getTime() + DAY_MS - 1)
    }
    filter.date = range
  }
  if (req.query.kind) {
    if (req.query.kind !== 'reading' && req.query.kind !== 'writing') {
      throw invalid('Kind must be reading or writing')
    }
    filter.kind = req.query.kind
  }
  if (req.query.pile) {
    if (typeof req.query.pile !== 'string' || !isValidObjectId(req.query.pile)) {
      throw invalid('Invalid pile')
    }
    filter.pile = req.query.pile
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000)
  return TimeEntry.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate('pile', 'name')
    .lean()
    .exec()
}

export const reqGetTimeEntry = async (req: Request) => {
  const doc = await TimeEntry.findById(req.params.id).populate('pile', 'name').lean().exec()
  if (!doc) {
    const e = new Error('Time entry not found') as Error & { status: number }
    e.status = 404
    throw e
  }
  return doc
}

export const reqUpdateTimeEntry = async (req: Request) => {
  const body = toEntryBody(req.body ?? {}, false)
  // A pile-less entry still needs its title: guard against clearing the
  // title off an entry with no pile.
  if (body.title !== undefined && !String(body.title).trim()) {
    const current = await TimeEntry.findById(req.params.id).lean().exec()
    const pileAfter = body.pile !== undefined ? body.pile : current?.pile
    if (!pileAfter) throw invalid('Give the entry a title or a pile')
  }
  if (body.pile !== undefined && !body.pile) {
    const current = await TimeEntry.findById(req.params.id).lean().exec()
    const titleAfter = body.title !== undefined ? body.title : current?.title
    if (!String(titleAfter ?? '').trim()) throw invalid('Give the entry a title or a pile')
  }
  const doc = await TimeEntry.findByIdAndUpdate(req.params.id, { $set: body }, { new: true })
    .populate('pile', 'name')
    .lean()
    .exec()
  if (!doc) {
    const e = new Error('Time entry not found') as Error & { status: number }
    e.status = 404
    throw e
  }
  return doc
}

export const reqDeleteTimeEntry = async (req: Request) => {
  await TimeEntry.findByIdAndDelete(req.params.id).exec()
}

export const reqGetTimeSummary = async (req: Request) => {
  const ref = req.query.date === undefined ? new Date() : parseDay(req.query.date)
  if (!ref || Number.isNaN(ref.getTime())) throw invalid('Date must be YYYY-MM-DD')
  const refDay = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()))
  const day = dayRange(refDay)
  const week = weekRange(refDay)

  const entries = await TimeEntry.find({ date: { $gte: week.start, $lt: week.end } })
    .populate('pile', 'name')
    .lean()
    .exec()
  const inDay = entries.filter((e: any) => e.date >= day.start && e.date < day.end)

  const byDay = []
  for (let t = week.start.getTime(); t < week.end.getTime(); t += DAY_MS) {
    const dStart = new Date(t)
    const dEnd = new Date(t + DAY_MS)
    const scoped = entries.filter((e: any) => e.date >= dStart && e.date < dEnd)
    byDay.push({ date: dayString(dStart), ...summarize(scoped as PopulatedEntry[]) })
  }

  return {
    daily: { date: dayString(refDay), ...summarize(inDay as PopulatedEntry[]) },
    weekly: {
      weekStart: dayString(week.start),
      weekEnd: dayString(new Date(week.end.getTime() - 1)),
      ...summarize(entries as PopulatedEntry[]),
      byDay,
    },
  }
}
