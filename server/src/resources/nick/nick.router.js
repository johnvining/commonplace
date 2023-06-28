import { Router } from 'express'
import {
  reqGenerateNickForNote,
  reqGenerateNickForWork,
  reqGenerateNickForIdea,
  reqGenerateNickForPile,
  reqGetNick,
} from './nick.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/note/:id').put(asyncWrapper(reqGenerateNickForNote, 200)) // TODO: check codes
router.route('/work/:id').put(asyncWrapper(reqGenerateNickForWork, 200)) // TODO: check codes
router.route('/idea/:id').put(asyncWrapper(reqGenerateNickForIdea, 200)) // TODO: check codes
router.route('/pile/:id').put(asyncWrapper(reqGenerateNickForPile, 200)) // TODO: check codes

router.route('/:nick').get(asyncWrapper(reqGetNick, 200)) // TODO: check codes

export default router
