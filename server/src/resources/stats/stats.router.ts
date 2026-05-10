import express from 'express'
import { getStats, getRecentItems } from './stats.controllers'

const router = express.Router()

router.get('/', getStats)
router.get('/recent/:type', getRecentItems)

export default router
