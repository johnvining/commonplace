import { Router } from 'express'
import {
  reqRegisterUser,
  reqAuthorizeUser,
  reqChangePassword,
} from './user.controllers'

const router = Router()

router.route('/').put(reqRegisterUser)
router.route('/changepass').put(reqChangePassword)
router.route('/auth').post(reqAuthorizeUser)

export default router
