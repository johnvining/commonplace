import { Router } from 'express'
import defaultControllers, {
  reqCreatePile,
  reqDeletePile,
  reqGetAutoComplete,
  reqGetAutoCompleteWithCounts,
  reqGetNotesForPile,
  reqGetWorksForPile,
  reqGetPileList
} from './pile.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router
  .route('/autocomplete/with-counts')
  .post(asyncWrapper(reqGetAutoCompleteWithCounts, 200))
router.route('/autocomplete').post(asyncWrapper(reqGetAutoComplete, 200))
router.route('/').post(asyncWrapper(reqCreatePile, 201))

router.route('/all').get(asyncWrapper(reqGetPileList, 200))

router.route('/:id/notes').get(asyncWrapper(reqGetNotesForPile, 200))
router.route('/:id/works').get(asyncWrapper(reqGetWorksForPile, 200))

router
  .route('/:id')
  .get(asyncWrapper(defaultControllers.getOne, 200))
  .put(asyncWrapper(defaultControllers.updateOne, 200))
  .delete(asyncWrapper(reqDeletePile, 204))

export default router
