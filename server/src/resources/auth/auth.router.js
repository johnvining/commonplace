import { Router } from 'express'
import {
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

router.route('/').post(asyncWrapper(reqCreateAuthor, 200))
router
  .route('/autocomplete/with-counts')
  .post(asyncWrapper(getAutoCompleteWithCounts, 200))
router.route('/autocomplete').post(asyncWrapper(getAutoComplete, 200))
router.route('/:id/delete').post(asyncWrapper(reqDeleteAuthor, 200))
router.route('/:id/notes').get(asyncWrapper(reqGetNotesForAuthor, 200))
router.route('/:id/works').get(asyncWrapper(reqGetWorksForAuthor, 200))
router.route('/:id').get(asyncWrapper(reqGetAuthorDetails, 200))

export default router
