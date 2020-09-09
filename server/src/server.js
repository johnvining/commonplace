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
import fileUpload from 'express-fileupload'

export const app = express()

app.disable('x-powered-by')

app.use(
  fileUpload({
    createParentPath: true
  })
)

app.use(cors())
app.use(json())
app.use(urlencoded({ extended: true }))
app.use(morgan('dev'))

app.use('/api/note', noteRouter)
app.use('/api/auth', authRouter)
app.use('/api/idea', ideaRouter)
app.use('/api/work', workRouter)

export const start = async () => {
  try {
    await connect()
    app.listen(config.port, () => {
      console.log(`REST API on http://localhost:${config.port}/api`)
    })
  } catch (e) {
    console.error(e)
  }
}
