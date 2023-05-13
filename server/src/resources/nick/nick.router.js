import { Router } from 'express'
import { reqGenerateNickForNote, reqGetNick } from './nick.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/note/:id').put(asyncWrapper(reqGenerateNickForNote, 200)) // TODO: check codes
// router.route('/work/:id').put(asyncWrapper(reqGenerateNickForWork, 200))
// router.route('/idea/:id').put(asyncWrapper(reqGenerateNickForIdea, 200))

router.route('/:nick').get(asyncWrapper(reqGetNick, 200)) // TODO: check codes

export default router
