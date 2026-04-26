import compression from 'compression'
import express from 'express'
import { json, urlencoded } from 'body-parser'
import morgan from 'morgan'
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

export const app = express()

app.disable('x-powered-by')
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
app.use(morgan('dev'))

app.use(cookieParser())

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

    console.log('Listening...')
    const server = app.listen(config.port, () => {
      console.log(`REST API on http://localhost:${config.port}/api`)
    })

    const shutdown = () => {
      server.close(() => process.exit(0))
    }
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  } catch (e) {
    console.error(e)
  }
}
