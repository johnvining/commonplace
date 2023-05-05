import mongoose from 'mongoose'
import config from '../config'

export const connect = (url = config.dbUrl, opts = {}) => {
  mongoose.set('strictQuery', false)
  return mongoose.connect(url, {
    ...opts
  })
}
