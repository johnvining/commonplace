import { isValidObjectId } from 'mongoose'
import TimeEntry, { TIME_KINDS } from './time.model.js'
import Pile from '../pile/pile.model.js'
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

  if (body.work !== undefined) {
    if (body.work === null || body.work === '') {
      out.work = null
    } else if (typeof body.work === 'string' && isValidObjectId(body.work)) {
      out.work = body.work
    } else {
      throw invalid('Invalid work')
    }
  } else if (isCreate) {
    out.work = null
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

  for (const field of ['startedAt', 'endedAt'] as const) {
    if (body[field] !== undefined) {
      if (body[field] === null || body[field] === '') {
        out[field] = null
      } else {
        const when = new Date(body[field])
        if (Number.isNaN(when.getTime())) throw invalid(`${field} must be an ISO timestamp`)
        out[field] = when
      }
    } else if (isCreate) {
      out[field] = null
    }
  }
  const started = (out.startedAt ?? body.startedAt) as Date | string | null | undefined
  const ended = (out.endedAt ?? body.endedAt) as Date | string | null | undefined
  if (started && ended && new Date(ended).getTime() < new Date(started).getTime()) {
    throw invalid('endedAt must not be before startedAt')
  }

  const title = (out.title ?? body.title ?? '') as string
  const pile = out.pile ?? body.pile
  const work = out.work ?? body.work
  if (isCreate && !String(title).trim() && !pile && !work) {
    throw invalid('Give the entry a title, a pile, or a work')
  }
  return out
}

type PopulatedEntry = {
  pile?: { _id?: unknown; name?: string } | null
  work?: { _id?: unknown; name?: string } | null
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
  const workMap = new Map<string, SubjectRow & { work: string; name: string }>()
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
    }
    const workId = e.work?._id ? String(e.work._id) : null
    if (workId) {
      const name = e.work?.name ?? 'Unknown work'
      const row = workMap.get(workId) ?? {
        work: workId,
        name,
        minutes: 0,
        readingMinutes: 0,
        writingMinutes: 0,
        entryCount: 0,
      }
      row.minutes += e.minutes
      row.entryCount += 1
      addKind(row, e.kind, e.minutes)
      workMap.set(workId, row)
    }
    if (!pileId && !workId) {
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
  const byWork = [...workMap.values()].sort((a, b) => b.minutes - a.minutes)
  const byTitle = [...titleMap.values()].sort((a, b) => b.minutes - a.minutes)
  return {
    totalMinutes: readingMinutes + writingMinutes,
    readingMinutes,
    writingMinutes,
    entryCount: entries.length,
    byPile,
    byWork,
    byTitle,
  }
}

export const reqCreateTimeEntry = async (req: Request) => {
  const doc = await TimeEntry.create(toEntryBody(req.body ?? {}, true))
  return TimeEntry.findById(doc._id).populate('pile', 'name').populate('work', 'name').lean().exec()
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
  if (req.query.work) {
    if (typeof req.query.work !== 'string' || !isValidObjectId(req.query.work)) {
      throw invalid('Invalid work')
    }
    filter.work = req.query.work
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000)
  return TimeEntry.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate('pile', 'name').populate('work', 'name')
    .lean()
    .exec()
}

export const reqGetTimeEntry = async (req: Request) => {
  const doc = await TimeEntry.findById(req.params.id).populate('pile', 'name').populate('work', 'name').lean().exec()
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
    .populate('pile', 'name').populate('work', 'name')
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

// Bulk import: an array of entry bodies, each validated like a create.
// A pile may be an ObjectId or an exact pile name. Every row is reported
// (#374 pattern), so one bad row doesn't fail the batch.
export const reqImportTimeEntries = async (req: Request) => {
  const entries = req.body?.entries
  if (!Array.isArray(entries) || !entries.length) {
    throw invalid('Provide a non-empty entries array')
  }
  if (entries.length > 2000) throw invalid('At most 2000 entries per import')
  const rows: Array<{ row: number; ok: boolean; error?: string; id?: string }> = []
  let imported = 0
  for (let i = 0; i < entries.length; i++) {
    const raw = entries[i] ?? {}
    try {
      const body: Record<string, unknown> = { ...raw }
      if (typeof body.pile === 'string' && body.pile && !isValidObjectId(body.pile)) {
        const pile = await Pile.findOne({ name: body.pile }).lean().exec()
        if (!pile) throw invalid(`Pile not found: ${body.pile}`)
        body.pile = String(pile._id)
      }
      const doc = await TimeEntry.create(toEntryBody(body, true))
      imported++
      rows.push({ row: i + 1, ok: true, id: String(doc._id) })
    } catch (e: any) {
      const message = e?.status === 400 && e?.message ? e.message : 'Invalid entry'
      rows.push({ row: i + 1, ok: false, error: message })
    }
  }
  return { imported, failed: rows.length - imported, rows }
}

// Recently logged subjects for quick re-logging: distinct titles and piles
// ordered by most recent use, each with the kind/minutes last logged.
export const reqRecentSubjects = async (req: Request) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
  const entries = await TimeEntry.find({})
    .sort({ date: -1, createdAt: -1 })
    .limit(500)
    .populate('pile', 'name').populate('work', 'name')
    .lean()
    .exec()
  const seen = new Set<string>()
  const subjects: Array<{
    key: string
    title?: string
    pile?: { id: string; name: string }
    work?: { id: string; name: string }
    kind: string
    minutes: number
    lastDate: string
  }> = []
  for (const e of entries as any[]) {
    const pileId = e.pile?._id ? String(e.pile._id) : null
    const workId = e.work?._id ? String(e.work._id) : null
    const key = pileId
      ? `pile:${pileId}`
      : workId
        ? `work:${workId}`
        : `title:${((e.title ?? '').trim() || 'Untitled').toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    if (workId && !pileId) {
      subjects.push({
        key,
        work: { id: workId, name: e.work?.name ?? 'Unknown work' },
        ...(e.title?.trim() ? { title: e.title.trim() } : {}),
        kind: e.kind,
        minutes: e.minutes,
        lastDate: dayString(new Date(e.date)),
      })
    } else if (pileId) {
      subjects.push({
        key,
        pile: { id: pileId, name: e.pile?.name ?? 'Unknown pile' },
        ...(e.title?.trim() ? { title: e.title.trim() } : {}),
        kind: e.kind,
        minutes: e.minutes,
        lastDate: dayString(new Date(e.date)),
      })
    } else {
      subjects.push({
        key,
        title: (e.title ?? '').trim() || 'Untitled',
        kind: e.kind,
        minutes: e.minutes,
        lastDate: dayString(new Date(e.date)),
      })
    }
    if (subjects.length >= limit) break
  }
  return subjects
}

function scopeSummary(
  entries: any[],
  start: Date,
  end: Date,
  withByDay: boolean
) {
  const scoped = entries.filter((e: any) => e.date >= start && e.date < end)
  const out: Record<string, unknown> = {
    start: dayString(start),
    end: dayString(new Date(end.getTime() - 1)),
    ...summarize(scoped as PopulatedEntry[]),
  }
  if (withByDay) {
    const byDay = []
    for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) {
      const dStart = new Date(t)
      const dEnd = new Date(t + DAY_MS)
      byDay.push({
        date: dayString(dStart),
        ...summarize(scoped.filter((e: any) => e.date >= dStart && e.date < dEnd) as PopulatedEntry[]),
      })
    }
    out.byDay = byDay
  }
  return out
}

export const reqGetTimeSummary = async (req: Request) => {
  const ref = req.query.date === undefined ? new Date() : parseDay(req.query.date)
  if (!ref || Number.isNaN(ref.getTime())) throw invalid('Date must be YYYY-MM-DD')
  const refDay = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()))
  const day = dayRange(refDay)
  const week = weekRange(refDay)
  const last7 = {
    start: new Date(refDay.getTime() - 6 * DAY_MS),
    end: new Date(refDay.getTime() + DAY_MS),
  }
  const month = {
    start: new Date(Date.UTC(refDay.getUTCFullYear(), refDay.getUTCMonth(), 1)),
    end: new Date(Date.UTC(refDay.getUTCFullYear(), refDay.getUTCMonth() + 1, 1)),
  }
  const widest = {
    start: new Date(Math.min(week.start.getTime(), month.start.getTime(), last7.start.getTime())),
    end: new Date(Math.max(week.end.getTime(), month.end.getTime(), last7.end.getTime())),
  }

  const entries = await TimeEntry.find({ date: { $gte: widest.start, $lt: widest.end } })
    .populate('pile', 'name').populate('work', 'name')
    .lean()
    .exec()
  const daily = scopeSummary(entries, day.start, day.end, false)
  const weekly = scopeSummary(entries, week.start, week.end, true)
  const rolling7 = scopeSummary(entries, last7.start, last7.end, true)
  const monthly = scopeSummary(entries, month.start, month.end, true)

  return {
    daily: { date: dayString(refDay), ...daily },
    weekly: {
      weekStart: dayString(week.start),
      weekEnd: dayString(new Date(week.end.getTime() - 1)),
      ...weekly,
    },
    last7: rolling7,
    monthly,
  }
}
