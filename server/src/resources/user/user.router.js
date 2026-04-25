import { Router } from 'express'
import {
  reqRegisterUser,
  reqAuthorizeUser,
  reqChangePassword,
  reqAuthenticate,
  reqCheckAuth,
  reqLogout,
} from './user.controllers'

const router = Router()

router.route('/').put(reqRegisterUser)
router.route('/changepass').put(reqChangePassword)
router.route('/auth').post(reqAuthorizeUser)
router.route('/me').get(reqAuthenticate, reqCheckAuth)
router.route('/logout').post(reqAuthenticate, reqLogout)

export default router
