import { Router } from 'express'
import controllers, {
  reqGetNotesForWork,
  reqGetWorkInfo,
  reqUpdateWork,
  reqCreateAndAddAuth,
  reqDeleteWork,
  reqCreateWork,
  reqAddPile,
  reqAddNewPile,
  reqAutocompleteOnName,
  reqGetAutoCompleteWithCounts,
  reqRemovePileFromWork
} from './work.controllers'

const router = Router()

router.route('/autocomplete/with-counts').post(reqGetAutoCompleteWithCounts)
router.route('/autocomplete').post(reqAutocompleteOnName)
router.route('/:id/notes').get(reqGetNotesForWork)
router.route('/:id/auth/create').put(reqCreateAndAddAuth)
router.route('/:id/delete').post(reqDeleteWork)

router.route('/:id/pile').put(reqAddPile)
router.route('/:id/pile/create').put(reqAddNewPile)
router.route('/:id/pile/:pileId').delete(reqRemovePileFromWork)

router.route('/:id').get(reqGetWorkInfo)
router.route('/:id').put(reqUpdateWork)

router.route('/').post(reqCreateWork)

export default router
