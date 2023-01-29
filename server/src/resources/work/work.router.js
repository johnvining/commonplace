import { Router } from 'express'
import {
  reqAddNewPile,
  reqAddPile,
  reqAutocompleteOnName,
  reqCreateAndAddAuth,
  reqCreateWork,
  reqDeleteWork,
  reqGetAutoCompleteWithCounts,
  reqGetNotesForWork,
  reqGetWorkInfo,
  reqRemovePileFromWork,
  reqUpdateWork
} from './work.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router
  .route('/autocomplete/with-counts')
  .post(asyncWrapper(reqGetAutoCompleteWithCounts, 200))
router.route('/autocomplete').post(asyncWrapper(reqAutocompleteOnName, 200))
router.route('/:id/notes').get(asyncWrapper(reqGetNotesForWork, 200))
router.route('/:id/auth/create').put(asyncWrapper(reqCreateAndAddAuth, 201))
router.route('/:id').delete(asyncWrapper(reqDeleteWork, 204))

router.route('/:id/pile').put(asyncWrapper(reqAddPile, 200))
router.route('/:id/pile/create').put(asyncWrapper(reqAddNewPile, 201))
router
  .route('/:id/pile/:pileId')
  .delete(asyncWrapper(reqRemovePileFromWork, 200))

router.route('/:id').get(asyncWrapper(reqGetWorkInfo, 200))
router.route('/:id').put(asyncWrapper(reqUpdateWork, 200))

router.route('/').post(asyncWrapper(reqCreateWork, 201))

export default router
