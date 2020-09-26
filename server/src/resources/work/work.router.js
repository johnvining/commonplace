import { Router } from 'express'
import controllers, {
  reqGetNotesForWork,
  reqGetWorkInfo,
  reqUpdateWork,
  reqCreateAndAddAuth,
  reqDeleteWork,
  reqCreateWork
} from './work.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.autocompleteOnName)
router.route('/:id/notes').get(reqGetNotesForWork)
router.route('/:id').get(reqGetWorkInfo)
router.route('/:id').put(reqUpdateWork)
router.route('/:id/auth/create').put(reqCreateAndAddAuth)
router.route('/:id/delete').post(reqDeleteWork)
router.route('/').post(reqCreateWork)

export default router
