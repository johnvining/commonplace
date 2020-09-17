import { Router } from 'express'
import {
  getAuthorDetails,
  getAutoComplete,
  getNotesFromAuthor,
  reqCreateAuthor,
  reqDeleteAuthor,
  reqGetWorksForAuthor
} from './auth.controllers'

const router = Router()

router.route('/').post(reqCreateAuthor)
router.route('/autocomplete').post(getAutoComplete)
router.route('/:id/delete').post(reqDeleteAuthor)
router.route('/:id/notes').get(getNotesFromAuthor)
router.route('/:id/works').get(reqGetWorksForAuthor)
router.route('/:id').get(getAuthorDetails)

export default router
