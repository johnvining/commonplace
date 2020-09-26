import { Router } from 'express'
import controllers, {
  reqAddIdea,
  reqAddImageToNote,
  reqAddNewIdea,
  reqAddNewPile,
  reqAddNewWork,
  reqAddPile,
  reqAddWork,
  reqFindNotesByString,
  reqGetImageForNote,
  reqGetRecentNotes,
  reqRemoveIdeaFromNote,
  reqUpdateNote
} from './note.controllers'

const router = Router()

router.route('/find').put(reqFindNotesByString)

router
  .route('/')
  .get(controllers.getMany)
  .post(controllers.createOne)

router.route('/all/:skip').get(reqGetRecentNotes)

router.route('/:id/idea').put(reqAddIdea)
router.route('/:id/idea/create').put(reqAddNewIdea)
router.route('/:id/idea/:ideaId').delete(reqRemoveIdeaFromNote)

router.route('/:id/pile').put(reqAddPile)
router.route('/:id/pile/create').put(reqAddNewPile)
// TODO: router.route('/:id/pile/:pileid').delete(reqRemoveIdeaFromNote)

router.route('/:id/work').put(reqAddWork)
router.route('/:id/work/create').put(reqAddNewWork)
// TODO: router.route('/:id/work/').delete()

router.route('/:id/image').put(reqAddImageToNote)
router.route('/:id/images/:image').get(reqGetImageForNote)
// TODO: router.route('/:id/image/:imageN').delete()

router
  .route('/:id')
  .get(controllers.getOne)
  .put(reqUpdateNote)
  .delete(controllers.removeOne)

export default router
