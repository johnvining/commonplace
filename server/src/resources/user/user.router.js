import { Router } from 'express'
import {
  reqRegisterUser,
  reqAuthorizeUser,
  reqChangePassword,
  reqAuthenticate,
  reqCheckAuth,
} from './user.controllers'

const router = Router()

router.route('/').put(reqRegisterUser)
router.route('/changepass').put(reqChangePassword)
router.route('/auth').post(reqAuthorizeUser)
router.route('/me').get(reqAuthenticate, reqCheckAuth)

export default router
