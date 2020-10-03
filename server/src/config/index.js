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
    console.log('...using development config')
    envConfig = require('./devconfig').config
    break
  case 'prod':
  case 'production':
    console.log('...using *production* config')
    envConfig = require('./prodconfig').config
    break
  default:
    console.log('...using development config')
    envConfig = require('./devconfig').config
}

export default merge(baseConfig, envConfig)
