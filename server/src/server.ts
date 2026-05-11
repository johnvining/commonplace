import compression from 'compression'
import express from 'express'
import { json, urlencoded } from 'body-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import config from './config'
import cors from 'cors'
import { connect } from './utils/db'
import Note from './resources/note/note.model'
import noteRouter from './resources/note/note.router'
import authRouter from './resources/auth/auth.router'
import ideaRouter from './resources/idea/idea.router'
import workRouter from './resources/work/work.router'
import pileRouter from './resources/pile/pile.router'
import nickRouter from './resources/nick/nick.router'
import linkRouter from './resources/link/link.router'
import userRouter from './resources/user/user.router'
import statsRouter from './resources/stats/stats.router'
import { reqAuthenticate } from './resources/user/user.controllers.js'
import cookieParser from 'cookie-parser'
import fileUpload from 'express-fileupload'
import { requireXhr } from './utils/requireXhr.js'

export const app = express()

app.disable('x-powered-by')
// helmet sets a sensible default of security headers (X-Content-Type-Options,
// Referrer-Policy, etc.). The API only serves JSON + images, never inline HTML,
// so we can be aggressive with the CSP. The frontend is served separately by
// nginx (or Parcel in dev) — that bundle's index.html has its own scripts.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        // Image responses come from this API; everything else is denied.
        imgSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
)
app.use(compression())

app.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 20 * 1024 * 1024 },
    abortOnLimit: true,
    useTempFiles: true,
    safeFileNames: true,
    preserveExtension: true,
  })
)

app.use(cors({
  origin: config.isDev ? true : false, // reflect request origin in dev; same-origin in prod via nginx
  credentials: true,
}))
app.use(json({ limit: '5mb' }))
app.use(urlencoded({ extended: true, limit: '5mb' }))
if (!process.env.VITEST) app.use(morgan('dev'))

app.use(cookieParser())
app.use('/api', requireXhr)

app.use('/api/user', userRouter)
app.all('*', reqAuthenticate) // TODO: Callback function

app.use('/api/note', noteRouter)
app.use('/api/auth', authRouter)
app.use('/api/idea', ideaRouter)
app.use('/api/work', workRouter)
app.use('/api/pile', pileRouter)
app.use('/api/nick', nickRouter)
app.use('/api/link', linkRouter)
app.use('/api/stats', statsRouter)

export const start = async () => {
  try {
    console.log('Connecting to Mongo...')
    await connect()

    await Note.syncIndexes()
  } catch (e) {
    // No Mongo means every route would 500. Crash hard so the supervisor
    // (systemd / docker / pm2) restarts us instead of serving broken
    // requests indefinitely.
    console.error('Failed to start: could not connect to Mongo', e)
    process.exit(1)
  }

  console.log('Listening...')
  const server = app.listen(config.port, () => {
    console.log(`REST API on http://localhost:${config.port}/api`)
  })

  // server.close() refuses to terminate while a request is in flight —
  // long OpenAI calls (OCR / bulk embed) can hold the socket for tens of
  // seconds. Force-exit after the timeout so a stuck request never blocks
  // a deploy or reboot indefinitely.
  const SHUTDOWN_TIMEOUT_MS = 15_000
  let shuttingDown = false
  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`Received ${signal}, shutting down...`)
    const killer = setTimeout(() => {
      console.error('Shutdown timeout reached, forcing exit')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    killer.unref()
    server.close(() => {
      clearTimeout(killer)
      process.exit(0)
    })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}
