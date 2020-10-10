export const asyncWrapper = (requestHandler, successCode) => {
  return async function(req, res) {
    try {
      const data = await requestHandler(req, res)
      if (!res.statusCode) {
        res.status(successCode).json({ data: data })
      }
    } catch (e) {
      console.error(e)
      res.status(400).end()
    }
  }
}
