import type { Request, Response } from 'express'
import type { Model } from 'mongoose'

type AnyModel = Model<unknown>

export const getOne = (model: AnyModel) => async (req: Request, res: Response) => {
  const doc = await model
    .findOne({ _id: req.params.id })
    .lean()
    .exec()

  if (!doc) {
    return res.status(400).end()
  }

  return doc
}

export const createOne = (model: AnyModel) => async (req: Request, res: Response) => {
  const toCreate = req.body
  const record = await model.create(toCreate)
  res.status(201).json(record)
}

export const removeOne = (model: AnyModel) => async (req: Request, res: Response) => {
  const id = req.params.id
  await model.deleteOne({ _id: id })
  res.status(200).end()
}

export const updateOne = (model: AnyModel) => async (req: Request, res: Response) => {
  const id = req.params.id
  await model.findOneAndUpdate({ _id: id }, { $set: req.body })
  res.status(200).end()
}

export const defaultControllers = (model: AnyModel) => ({
  removeOne: removeOne(model),
  updateOne: updateOne(model),
  getOne: getOne(model),
  createOne: createOne(model),
})

export default defaultControllers
