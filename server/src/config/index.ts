import { merge } from 'lodash'

interface Secrets {
  jwt?: string
  jwtExp: string
  ngrokAuth: string
  openaiorg?: string
  openaikey?: string
}

interface Config {
  env: string
  isDev: boolean
  port: number
  secrets: Secrets
  ngrokUrl: string
  dbUrl: string
  imageStorePath: string
}

const env = process.env.NODE_ENV || 'development'

const baseConfig = {
  env,
  isDev: env === 'development',
  port: 3000,
  secrets: {
    jwt: process.env.JWT_SECRET,
    jwtExp: '100d',
    ngrokAuth: '',
  },
  ngrokUrl: '',
}

let envConfig: Partial<Config> = {}

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

export default merge(baseConfig, envConfig) as Config
