import { Router } from 'express'
import defaultControllers, {
  reqGetNotesForIdea,
  reqCreateIdea,
  reqDeleteIdea,
  reqGetAutoComplete,
  reqGetAutoCompleteWithCounts,
  reqGetIdeaInfo
} from './idea.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router
  .route('/autocomplete/with-counts')
  .post(asyncWrapper(reqGetAutoCompleteWithCounts, 200))
router.route('/autocomplete').post(asyncWrapper(reqGetAutoComplete, 200))

router.route('/:id/delete').post(asyncWrapper(reqDeleteIdea, 204))
router.route('/:id/notes').get(asyncWrapper(reqGetNotesForIdea, 200))

router.route('/:id').get(asyncWrapper(defaultControllers.getOne, 200))

router.route('/').post(asyncWrapper(reqCreateIdea, 201))

export default router
