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

export const reqListPins = async () => {
  const pins = await Pin.find({}).sort({ pinnedAt: -1 }).lean().exec()
  return pins.map(toItem)
}

// PUT /pin { type, id, label, href }: star an item (or move it to the top).
export const reqPin = async (req: Request, res: Response) => {
  const pin = parse({ ...req.body, pinnedAt: undefined })
  if (!pin) return res.status(400).json({ message: 'Need a known type and a record id' })
  const saved = await Pin.findOneAndUpdate(
    { type: pin.type, target: pin.target },
    { $set: pin },
    { upsert: true, new: true }
  )
    .lean()
    .exec()
  return toItem(saved)
}

// DELETE /pin/:type/:id: unstar.
export const reqUnpin = async (req: Request) => {
  await Pin.deleteOne({ type: req.params.type, target: req.params.id }).exec()
  return { ok: true }
}

// POST /pin/import { items }: add stars kept only in a browser so far,
// keeping their order; ones already here are left as they are.
export const reqImportPins = async (req: Request) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : []
  const pins = items.map(parse).filter(Boolean) as NonNullable<ReturnType<typeof parse>>[]
  if (pins.length) {
    await Pin.bulkWrite(
      pins.map((pin) => ({
        updateOne: {
          filter: { type: pin.type, target: pin.target },
          update: { $setOnInsert: pin },
          upsert: true,
        },
      }))
    )
  }
  return reqListPins()
}
