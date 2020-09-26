import { Router } from 'express'
// import * as controllers from './idea.controllers'
import controllers, {
  getIdeasByStringWithNotes,
  reqDeleteIdea,
  getNotesFromIdea,
  reqGetIdeaInfo,
  reqCreateIdea
} from './idea.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.autocompleteOnName)
router.route('/autocomplete/with-notes').put(getIdeasByStringWithNotes)
router.route('/:id/delete').post(reqDeleteIdea)
router.route('/:id/notes').get(getNotesFromIdea)

router.route('/:id').get(reqGetIdeaInfo)

router.route('/').post(reqCreateIdea)

export default router
