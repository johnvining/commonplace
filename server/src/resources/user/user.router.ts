import { Router } from 'express'
import {
  reqRegisterUser,
  reqAuthorizeUser,
  reqChangePassword,
  reqAuthenticate,
  reqCheckAuth,
  reqLogout,
  reqLogoutEverywhere,
} from './user.controllers'
import { authRateLimiter } from '../../utils/rateLimits.js'

const router = Router()

router.route('/').put(authRateLimiter, reqRegisterUser)
router.route('/changepass').put(authRateLimiter, reqChangePassword)
router.route('/auth').post(authRateLimiter, reqAuthorizeUser)
router.route('/me').get(reqAuthenticate, reqCheckAuth)
router.route('/logout').post(reqAuthenticate, reqLogout)
router.route('/logout-everywhere').post(reqAuthenticate, reqLogoutEverywhere)

export default router
