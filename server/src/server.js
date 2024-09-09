import express from 'express'
import { json, urlencoded } from 'body-parser'
import morgan from 'morgan'
import config from './config'
import cors from 'cors'
import { connect } from './utils/db'
import noteRouter from './resources/note/note.router'
import authRouter from './resources/auth/auth.router'
import ideaRouter from './resources/idea/idea.router'
import workRouter from './resources/work/work.router'
import pileRouter from './resources/pile/pile.router'
import nickRouter from './resources/nick/nick.router'
import linkRouter from './resources/link/link.router'
import userRouter from './resources/user/user.router'
import { reqAuthenticate } from './resources/user/user.controllers.js'
import cookieParser from 'cookie-parser'
import fileUpload from 'express-fileupload'

export const app = express()

app.disable('x-powered-by')

app.use(
  fileUpload({
    createParentPath: true,
  })
)

app.use(cors())
app.use(json())
app.use(urlencoded({ extended: true }))
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

export const start = async () => {
  try {
    await connect()

    if (!config.isDev) {
      console.log('Startning ngrok...')
      const url = await ngrok.connect({
        proto: 'http',
        authtoken: config.secrets.ngrokAuth,
        hostname: config.ngrokUrl,
        addr: config.port,
      })

      console.log(`Listening on url ${url}`)
    }

    app.listen(config.port, () => {
      console.log(`REST API on http://localhost:${config.port}/api`)
    })
  } catch (e) {
    console.error(e)
  }
}
