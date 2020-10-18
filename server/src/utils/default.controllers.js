export const getOne = model => async (req, res) => {
  const doc = await model
    .find({ _id: req.params.id })
    .lean()
    .exec()

  if (!doc) {
    return res.status(400).end()
  }

  return doc
}

export const createOne = model => async (req, res) => {
  const toCreate = req.body
  const record = await model.create(toCreate)
  res.status(201).json(record)
}

export const removeOne = model => async (req, res) => {
  const id = req.params.id
  await model.deleteOne({ _id: id })
  res.status(200).end()
}

export const defaultControllers = model => ({
  removeOne: removeOne(model),
  getOne: getOne(model),
  createOne: createOne(model)
})
