import mongoose from 'mongoose'
import type { ConnectOptions } from 'mongoose'
import config from '../config'

export const connect = (
  url: string = config.dbUrl,
  opts: ConnectOptions = {}
): Promise<typeof mongoose> => {
  mongoose.set('strictQuery', false)
  return mongoose.connect(url, {
    ...opts,
  })
}
