// Stolen from front end masters

export const getMany = model => async (req, res) => {
  try {
    const docs = await model
      .find({})
      .lean()
      .exec()

    res.status(200).json({ data: docs })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

// TODO: Refactor out when using Note
export const getOne = model => async (req, res) => {
  try {
    const doc = await model
      .find({ _id: req.params.id })
      .populate('author')
      .populate('ideas')
      .populate('piles')
      .populate({
        path: 'work',
        populate: {
          path: 'author'
        }
      })
      .lean()
      .exec()

    if (!doc) {
      return res.status(400).end()
    }

    res.status(200).json({ data: doc })
  } catch (e) {
    console.error(e)
    res.status(400).end()
  }
}

// TODO: Move to note controllers
export const createOne = model => async (req, res) => {
  const toCreate = req.body
  const item = await model.create(toCreate)
  res.status(201).json(item)
}

export const removeOne = model => async (req, res) => {
  const id = req.params.id
  await model.deleteOne({ _id: id })
  res.status(200).end()
}

export const crudControllers = model => ({
  removeOne: removeOne(model),
  getMany: getMany(model),
  getOne: getOne(model),
  createOne: createOne(model)
})
