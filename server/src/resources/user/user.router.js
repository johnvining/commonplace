import { Router } from 'express'
import { reqRegisterUser, reqAuthorizeUser } from './user.controllers'

const router = Router()

router.route('/').put(reqRegisterUser)
router.route('/auth').post(reqAuthorizeUser)

export default router
