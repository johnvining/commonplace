import { Router } from 'express'
import {
  getNotesFromAuthor,
  getAuthorDetails,
  getAutoComplete,
  reqCreateAuthor
} from './auth.controllers'

const router = Router()

router.route('/').post(reqCreateAuthor)
router.route('/autocomplete').post(getAutoComplete)
router.route('/:id').get(getAuthorDetails)
router.route('/:id/notes').get(getNotesFromAuthor)

export default router
