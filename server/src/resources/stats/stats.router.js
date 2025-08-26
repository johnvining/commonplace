import express from 'express'
import { getStats } from './stats.controllers'

const router = express.Router()

router.get('/', getStats)

export default router
