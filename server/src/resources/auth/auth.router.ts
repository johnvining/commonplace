import { Router } from 'express'
import defaultControllers, {
  getAutoComplete,
  getAutoCompleteWithCounts,
  reqCreateAuthor,
  reqDeleteAuthor,
  reqMergeAuthor,
  reqGetNotesForAuthor,
  reqGetAllNotesForAuthor,
  reqGetNotesAboutAuthor,
  reqGetWorksForAuthor,
  reqGetCreditsForAuthor
} from './auth.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/').post(asyncWrapper(reqCreateAuthor, 201))
router
  .route('/autocomplete/with-counts')
  .post(asyncWrapper(getAutoCompleteWithCounts, 200))
router.route('/autocomplete').post(asyncWrapper(getAutoComplete, 200))
router.route('/:id/delete').delete(asyncWrapper(reqDeleteAuthor, 204))
router.route('/:id/merge').post(asyncWrapper(reqMergeAuthor, 200))
router.route('/:id/notes').get(asyncWrapper(reqGetNotesForAuthor, 200))
router.route('/:id/all-notes').get(asyncWrapper(reqGetAllNotesForAuthor, 200))
router.route('/:id/notes-about').get(asyncWrapper(reqGetNotesAboutAuthor, 200))
router.route('/:id/works').get(asyncWrapper(reqGetWorksForAuthor, 200))
router.route('/:id/credits').get(asyncWrapper(reqGetCreditsForAuthor, 200))
// DELETE /:id is what the site sends (as for works, piles and notes);
// /:id/delete stays for the CLI.
router
  .route('/:id')
  .get(asyncWrapper(defaultControllers.getOne, 200))
  .put(asyncWrapper(defaultControllers.updateOne, 200))
  .delete(asyncWrapper(reqDeleteAuthor, 204))

export default router
