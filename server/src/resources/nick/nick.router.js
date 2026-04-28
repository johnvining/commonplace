import { Router } from 'express'
import {
  reqGenerateNickForNote,
  reqGenerateNickForWork,
  reqGenerateNickForIdea,
  reqGenerateNickForPile,
  reqGetNick,
  reqGetNickForNote,
  reqGetNickForWork,
  reqGetNickForIdea,
  reqGetNickForPile,
  reqBackfillNicks,
  reqBackfillNicksStatus,
} from './nick.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/backfill').post(asyncWrapper(reqBackfillNicks, 200))
router.route('/backfill/status').get(asyncWrapper(reqBackfillNicksStatus, 200))

router.route('/note/:id').get(asyncWrapper(reqGetNickForNote, 200)).put(asyncWrapper(reqGenerateNickForNote, 200))
router.route('/work/:id').get(asyncWrapper(reqGetNickForWork, 200)).put(asyncWrapper(reqGenerateNickForWork, 200))
router.route('/idea/:id').get(asyncWrapper(reqGetNickForIdea, 200)).put(asyncWrapper(reqGenerateNickForIdea, 200))
router.route('/pile/:id').get(asyncWrapper(reqGetNickForPile, 200)).put(asyncWrapper(reqGenerateNickForPile, 200))

router.route('/:nick').get(asyncWrapper(reqGetNick, 200))

export default router
