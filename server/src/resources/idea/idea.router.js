import { Router } from 'express'
import {
  reqDeleteIdea,
  getNotesFromIdea,
  reqGetIdeaInfo,
  reqCreateIdea,
  getAutoCompleteWithCounts,
  reqGetAutoComplete
} from './idea.controllers'

const router = Router()

router.route('/autocomplete/with-counts').post(getAutoCompleteWithCounts)
router.route('/autocomplete').post(reqGetAutoComplete)

router.route('/:id/delete').post(reqDeleteIdea)
router.route('/:id/notes').get(getNotesFromIdea)

router.route('/:id').get(reqGetIdeaInfo)

router.route('/').post(reqCreateIdea)

export default router
