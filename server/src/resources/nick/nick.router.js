import { Router } from 'express'
import { reqGenerateNickForNote } from './nick.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/note/:id').put(asyncWrapper(reqGenerateNickForNote, 200))
// router.route('/work/:id').put(asyncWrapper(reqGenerateNickForWork, 200))
// router.route('/idea/:id').put(asyncWrapper(reqGenerateNickForIdea, 200))

// TODO: Resolve Nick

export default router
