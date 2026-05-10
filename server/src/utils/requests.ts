import type { Request, Response, RequestHandler } from 'express'

type AsyncHandler = (req: Request, res: Response) => Promise<unknown>

export const asyncWrapper = (
  requestHandler: AsyncHandler,
  successCode: number
): RequestHandler => {
  return async function (req, res) {
    try {
      const data = await requestHandler(req, res)
      res.status(successCode).json({ data: data })
    } catch (e) {
      console.error(e)
      res.status(400).end()
    }
  }
}
