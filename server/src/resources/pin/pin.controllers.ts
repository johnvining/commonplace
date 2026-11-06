import type { Request, Response } from 'express'
import Pin from './pin.model.js'

const TYPES = new Set(['note', 'work', 'auth', 'idea', 'pile'])

interface PinInput {
  type?: unknown
  id?: unknown
  label?: unknown
  href?: unknown
  pinnedAt?: unknown
}

// The shape the site uses: { type, id, label, href, pinnedAt (ms) }.
const toItem = (pin: any) => ({
  type: pin.type,
  id: pin.target,
  label: pin.label,
  href: pin.href,
  pinnedAt: new Date(pin.pinnedAt).getTime(),
})

// Validate one item from a request; null when it isn't a usable pin.
function parse(input: PinInput) {
  const type = typeof input.type === 'string' ? input.type : ''
  const id = typeof input.id === 'string' ? input.id : ''
  if (!TYPES.has(type) || !/^[0-9a-f]{24}$/i.test(id)) return null
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
  const at = typeof input.pinnedAt === 'number' ? new Date(input.pinnedAt) : new Date()
  return {
    type,
    target: id,
    label: text(input.label, 300),
    href: text(input.href, 300),
    pinnedAt: isNaN(at.getTime()) ? new Date() : at,
  }
}

// Starred = has no tombstone. Stars whose record no longer exists are
// dropped as the list is read (#381).
export const reqListPins = async () => {
  const pins = await Pin.find({ unpinnedAt: null }).sort({ pinnedAt: -1 }).lean().exec()
  const gone = await danglingPins(pins)
  if (gone.length) await Pin.deleteMany({ _id: { $in: gone } }).exec()
  const goneIds = new Set(gone.map(String))
  return pins.filter((p) => !goneIds.has(String(p._id))).map(toItem)
}

async function danglingPins(pins: { _id: unknown; type: string; target: string }[]) {
  const { default: mongoose } = await import('mongoose')
  const gone: unknown[] = []
  for (const type of TYPES) {
    const ofType = pins.filter((p) => p.type === type)
    if (!ofType.length) continue
    const model = mongoose.model(type === 'auth' ? 'author' : type)
    const existing = new Set((await model.find({ _id: { $in: ofType.map((p) => p.target) } }, { _id: 1 }).lean()).map((d: any) => String(d._id)))
    gone.push(...ofType.filter((p) => !existing.has(p.target)).map((p) => p._id))
  }
  return gone
}

// When a change was made, from the device's clock in ms; never later than
// a minute from now, so one skewed clock can't win every conflict
function stamp(at: unknown): Date {
  const now = Date.now()
  const ms = typeof at === 'number' && Number.isFinite(at) ? Math.min(at, now + 60_000) : now
  return new Date(ms)
}

// Apply one star or unstar, unless the stored row already has a later
// change: last write wins, by when each change was made (#381). An unstar
// of something never starred still leaves a tombstone, so an older star
// from another device can't bring it back.
export async function applyPinChange(op: 'pin' | 'unpin', input: PinInput & { at?: unknown }) {
  const pin = parse(input)
  if (!pin) return false
  const at = stamp(input.at)
  const existing = await Pin.findOne({ type: pin.type, target: pin.target }).lean().exec()
  const last = existing?.changedAt ?? existing?.unpinnedAt ?? existing?.pinnedAt
  if (existing && last && last >= at) return false
  const update =
    op === 'pin'
      ? { $set: { label: pin.label, href: pin.href, pinnedAt: at, changedAt: at }, $unset: { unpinnedAt: 1 } }
      : { $set: { unpinnedAt: at, changedAt: at }, $setOnInsert: { pinnedAt: at } }
  await Pin.updateOne({ type: pin.type, target: pin.target }, update, { upsert: true }).exec()
  return true
}

// POST /pin/sync { ops: [{ op: 'pin' | 'unpin', type, id, label, href, at }] }:
// apply a device's queued changes in order, then return the starred list
export const reqSyncPins = async (req: Request) => {
  const ops = Array.isArray(req.body?.ops) ? req.body.ops.slice(0, 500) : []
  for (const op of ops) {
    if (op?.op === 'pin' || op?.op === 'unpin') await applyPinChange(op.op, op)
  }
  return reqListPins()
}

// PUT /pin { type, id, label, href }: star an item (or move it to the top).
export const reqPin = async (req: Request, res: Response) => {
  if (!parse(req.body ?? {})) return res.status(400).json({ message: 'Need a known type and a record id' })
  await applyPinChange('pin', { ...req.body, at: Date.now() })
  const saved = await Pin.findOne({ type: req.body.type, target: req.body.id }).lean().exec()
  return toItem(saved)
}

// DELETE /pin/:type/:id: unstar.
export const reqUnpin = async (req: Request) => {
  await applyPinChange('unpin', { type: req.params.type, id: req.params.id, at: Date.now() })
  return { ok: true }
}

// POST /pin/import { items }: add stars kept only in a browser so far,
// keeping their order; ones already here, starred or not, are left as
// they are.
export const reqImportPins = async (req: Request) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : []
  const pins = items.map(parse).filter(Boolean) as NonNullable<ReturnType<typeof parse>>[]
  if (pins.length) {
    await Pin.bulkWrite(
      pins.map((pin) => ({
        updateOne: {
          filter: { type: pin.type, target: pin.target },
          update: { $setOnInsert: { ...pin, changedAt: pin.pinnedAt } },
          upsert: true,
        },
      }))
    )
  }
  return reqListPins()
}
