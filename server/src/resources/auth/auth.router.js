import { Router } from 'express'
import defaultControllers, {
  getAutoComplete,
  getAutoCompleteWithCounts,
  reqCreateAuthor,
  reqDeleteAuthor,
  reqGetAuthorDetails,
  reqGetNotesForAuthor,
  reqGetWorksForAuthor
} from './auth.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/').post(asyncWrapper(reqCreateAuthor, 201))
router
  .route('/autocomplete/with-counts')
  .post(asyncWrapper(getAutoCompleteWithCounts, 200))
router.route('/autocomplete').post(asyncWrapper(getAutoComplete, 200))
router.route('/:id/delete').delete(asyncWrapper(reqDeleteAuthor, 204))
router.route('/:id/notes').get(asyncWrapper(reqGetNotesForAuthor, 200))
router.route('/:id/works').get(asyncWrapper(reqGetWorksForAuthor, 200))
router
  .route('/:id')
  .get(asyncWrapper(defaultControllers.getOne, 200))
  .put(asyncWrapper(defaultControllers.updateOne, 200))

export default router
