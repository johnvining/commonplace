import { Router } from 'express'
import controllers, {
  reqGetNotesForWork,
  reqGetWorkInfo,
  reqUpdateWork,
  reqCreateAndAddAuth,
  reqDeleteWork,
  reqCreateWork,
  reqAddPile,
  reqAddNewPile
} from './work.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.autocompleteOnName)
router.route('/:id/notes').get(reqGetNotesForWork)
router.route('/:id/auth/create').put(reqCreateAndAddAuth)
router.route('/:id/delete').post(reqDeleteWork)

router.route('/:id/pile').put(reqAddPile)
router.route('/:id/pile/create').put(reqAddNewPile)

router.route('/:id').get(reqGetWorkInfo)
router.route('/:id').put(reqUpdateWork)

router.route('/').post(reqCreateWork)

export default router
