import { Router } from 'express'
import { reqImportPins, reqListPins, reqPin, reqUnpin } from './pin.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/').get(asyncWrapper(reqListPins, 200)).put(asyncWrapper(reqPin, 200))
router.route('/import').post(asyncWrapper(reqImportPins, 200))
router.route('/:type/:id').delete(asyncWrapper(reqUnpin, 200))

export default router
