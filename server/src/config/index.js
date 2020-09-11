import { merge } from 'lodash'
const env = process.env.NODE_ENV || 'development'

const baseConfig = {
  env,
  isDev: env === 'development',
  port: 3000,
  secrets: {
    jwt: process.env.JWT_SECRET,
    jwtExp: '100d'
  }
}

let envConfig = {}

switch (env) {
  case 'dev':
  case 'development':
    envConfig = require('./dev-mine').config
    break
  default:
    envConfig = require('./dev-mine').config
}

export default merge(baseConfig, envConfig)
