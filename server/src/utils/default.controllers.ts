import type { Request, Response } from 'express'
import type { Model } from 'mongoose'
import { pickAllowed } from './pickAllowed.js'

// Accept any Mongoose Model — controllers across resources pass concretely
// typed models (Note, Auth, Work, ...) and inferred schema generics make a
// strictly typed wrapper noisy with no real safety win for these CRUD shims.
//
// Each helper returns a value rather than writing to `res` directly, so they
// compose cleanly with `asyncWrapper` (which is responsible for the response).
// Routes wired without `asyncWrapper` should pass `res` to consume manually.
type AnyModel = Model<any>

export type ControllerOpts = {
  // If provided, write requests have their bodies filtered to these fields
  // before they hit the model. Resources should declare a whitelist to keep
  // server-controlled fields (embeddings, hashes, timestamps) out of reach.
  writable?: readonly string[]
}

export const getOne = (model: AnyModel) => async (req: Request, res: Response) => {
  const doc = await model.findOne({ _id: req.params.id }).lean().exec()
  if (!doc) {
    res.status(400).end()
    return
  }
  return doc
}

// Note: createOne writes to `res` directly because the only caller (note
// router) wires it without asyncWrapper. Wrapping it would change the
// response shape from `record` to `{ data: record }` and break clients.
// Because we bypass asyncWrapper, errors are handled inline — honor a
// .status on the thrown error so pickAllowed's InvalidFieldsError surfaces
// as a real 400 instead of leaking as an unhandled rejection.
export const createOne = (model: AnyModel, opts: ControllerOpts = {}) => async (
  req: Request,
  res: Response
) => {
  try {
    const body = opts.writable ? pickAllowed(req.body, opts.writable) : req.body
    const record = await model.create(body)
    res.status(201).json(record)
  } catch (e) {
    const status =
      e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number'
        ? (e as { status: number }).status
        : 500
    const message = status === 500 ? 'Internal error' : (e as Error).message
    if (!process.env.VITEST) console.error(`[${req.method} ${req.originalUrl}]`, e)
    res.status(status).json({ message })
  }
}

export const removeOne = (model: AnyModel) => async (req: Request) => {
  await model.deleteOne({ _id: req.params.id })
  return null
}

export const updateOne = (model: AnyModel, opts: ControllerOpts = {}) => async (
  req: Request
) => {
  const body = opts.writable ? pickAllowed(req.body, opts.writable) : req.body
  await model.findOneAndUpdate({ _id: req.params.id }, { $set: body })
  return null
}

export const defaultControllers = (model: AnyModel, opts: ControllerOpts = {}) => ({
  removeOne: removeOne(model),
  updateOne: updateOne(model, opts),
  getOne: getOne(model),
  createOne: createOne(model, opts),
})

export default defaultControllers
