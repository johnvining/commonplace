import type { Request, Response, NextFunction } from 'express'
import { isValidObjectId } from 'mongoose'

// Middleware that 400s when an id-shaped param isn't a valid ObjectId. Without
// this, controllers either CastError later (asyncWrapper turns it into a
// generic 400) or — worse — pass attacker-controlled non-hex strings into
// filesystem paths (`config.imageStorePath + '/' + req.params.id`).
//
// Apply selectively. `req.params.image` (a 1-based index) and `req.params.nick`
// are NOT ObjectIds and should not be checked.
export function requireObjectIdParam(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    for (const name of paramNames) {
      const v = req.params[name]
      if (v !== undefined && !isValidObjectId(v)) {
        return res.status(400).json({ message: `Invalid ${name}` })
      }
    }
    next()
  }
}
