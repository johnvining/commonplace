import express from 'express'
import { getStats, getRecentItems } from './stats.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = express.Router()

router.get('/', getStats)
router.get('/recent/:type', asyncWrapper(getRecentItems, 200))

export default router
