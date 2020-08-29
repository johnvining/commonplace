import { Router } from 'express'
import * as controllers from './idea.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.getAutoComplete)
router.route('/:id/notes').get(controllers.getNotesFromIdea)

router.route('/:id').get(controllers.reqGetIdeaInfo)

router.route('/').post(controllers.reqCreateIdea)

//   .put(controllers.updateOne)
//   .delete(controllers.removeOne)

export default router
