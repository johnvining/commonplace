import { Router } from 'express'
import controllers, {
  getRecentNotes,
  addTopic,
  addNewTopic,
  reqUpdateNote,
  addWork,
  addNewWork,
  reqFindNotesByString,
  reqRemoveIdeaFromNote
} from './note.controllers'

const router = Router()

router.route('/find').put(reqFindNotesByString)

router
  .route('/')
  .get(controllers.getMany)
  .post(controllers.createOne)

router.route('/all').get(getRecentNotes)

router.route('/:id/idea').put(addTopic)
router.route('/:id/idea/create').put(addNewTopic)
router.route('/:id/work').put(addWork)
router.route('/:id/work/create').put(addNewWork)
router.route('/:id/idea/:ideaId').delete(reqRemoveIdeaFromNote)

router
  .route('/:id')
  .get(controllers.getOne)
  .put(reqUpdateNote)
  .delete(controllers.removeOne)

export default router
