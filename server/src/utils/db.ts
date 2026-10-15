import mongoose from 'mongoose'
import type { ConnectOptions } from 'mongoose'
import config from '../config'

// Run schema validators on findOneAndUpdate/updateOne too, not just on
// create/save, so updates can't write values (like blank names) that a
// create would reject.
mongoose.set('runValidators', true)

export const connect = (
  url: string = config.dbUrl,
  opts: ConnectOptions = {}
): Promise<typeof mongoose> => {
  mongoose.set('strictQuery', false)
  return mongoose.connect(url, {
    ...opts,
  })
}
