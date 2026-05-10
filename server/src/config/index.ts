import { merge } from 'lodash'
import dotenv from 'dotenv'

// Load .env before reading anything. .env values do not override existing
// process.env (so CI / Docker can still set vars directly).
dotenv.config()

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

// Secrets prefer env vars (suitable for production, CI, containers).
// devconfig.js / prodconfig.js can still supply them as a local fallback
// during development — but anything in .env wins.
const baseConfig = {
  env,
  isDev: env === 'development' || env === 'test',
  port: 3000,
  secrets: {
    jwt: process.env.JWT_SECRET,
    jwtExp: '100d',
    ngrokAuth: process.env.NGROK_AUTH ?? '',
    openaiorg: process.env.OPENAI_ORG,
    openaikey: process.env.OPENAI_API_KEY,
  },
  ngrokUrl: '',
}

let envConfig: Partial<Config> = {}

function loadFileConfigOrEmpty(path: string): Partial<Config> {
  try {
    return require(path).config ?? {}
  } catch {
    return {}
  }
}

switch (env) {
  case 'dev':
  case 'development':
    console.log('...using development config')
    envConfig = loadFileConfigOrEmpty('./devconfig')
    break
  case 'prod':
  case 'production':
    console.log('...using *production* config')
    envConfig = loadFileConfigOrEmpty('./prodconfig')
    break
  default:
    console.log('...using development config')
    envConfig = loadFileConfigOrEmpty('./devconfig')
}

// Env-provided secrets take precedence over file-provided secrets.
const merged = merge({}, envConfig, baseConfig) as Config

// But if the env var is missing and the file has a value, fall back to the
// file. Merge order above means env var (in baseConfig) overrides file even
// when env var is undefined — undo that for secrets.
const fileSecrets = (envConfig.secrets ?? {}) as Partial<Secrets>
merged.secrets = {
  ...fileSecrets,
  ...Object.fromEntries(
    Object.entries(baseConfig.secrets).filter(([, v]) => v !== undefined && v !== '')
  ),
} as Secrets

export default merged
