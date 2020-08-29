import { Router } from 'express'
import * as controllers from './work.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.getAutoComplete)
router.route('/:id/notes').get(controllers.getNotesFromWork)
router.route('/:id').get(controllers.reqGetWorkInfo)
router.route('/:id').put(controllers.reqUpdateWork)
router.route('/:id/auth/create').put(controllers.reqCreateAndAddAuth)
router.route('/').post(controllers.reqCreateWork)

//   .put(controllers.updateOne)
//   .delete(controllers.removeOne)

export default router
