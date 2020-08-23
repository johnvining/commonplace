import { Router } from 'express'
// import controllers, { getTenMostRecentNotes } from './note.controllers'
import * as controllers from './idea.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.getAutoComplete)
router.route('/:id/notes').get(controllers.getNotesFromIdea)

// router.route('/all').get(getTenMostRecentNotes)

// router
//   .route('/:id')
//   .get(controllers.getOne)
//   .put(controllers.updateOne)
//   .delete(controllers.removeOne)

export default router
