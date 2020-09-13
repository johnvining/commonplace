import { Router } from 'express'
import * as controllers from './work.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.getAutoComplete)
router.route('/:id/notes').get(controllers.reqGetNotesForWork)
router.route('/:id').get(controllers.reqGetWorkInfo)
router.route('/:id').put(controllers.reqUpdateWork)
router.route('/:id/auth/create').put(controllers.reqCreateAndAddAuth)
router.route('/:id/delete').post(controllers.reqDeleteWork)
router.route('/').post(controllers.reqCreateWork)

//   .put(controllers.updateOne)
//   .delete(controllers.removeOne)

export default router
