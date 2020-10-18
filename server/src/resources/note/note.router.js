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
  reqUpdateNote,
  reqRemovePileFromNote,
  reqRemoveImageFromNote,
  reqGetNoteDetails
} from './note.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/find').put(asyncWrapper(reqFindNotesByString, 200))

router.route('/').post(controllers.createOne)

router.route('/all/:skip').get(asyncWrapper(reqGetRecentNotes, 200))

router.route('/:id/idea').put(asyncWrapper(reqAddIdea, 200))
router.route('/:id/idea/create').put(asyncWrapper(reqAddNewIdea, 201))
router
  .route('/:id/idea/:ideaId')
  .delete(asyncWrapper(reqRemoveIdeaFromNote, 200))

router.route('/:id/pile').put(asyncWrapper(reqAddPile, 200))
router.route('/:id/pile/create').put(asyncWrapper(reqAddNewPile, 201))
router
  .route('/:id/pile/:pileId')
  .delete(asyncWrapper(reqRemovePileFromNote, 200))

router.route('/:id/work').put(asyncWrapper(reqAddWork, 200))
router.route('/:id/work/create').put(asyncWrapper(reqAddNewWork, 201))
// TODO: router.route('/:id/work/').delete()

router.route('/:id/image').put(reqAddImageToNote)
router.route('/:id/images/:image').get(reqGetImageForNote)
router.route('/:id/image/').delete(reqRemoveImageFromNote)

router
  .route('/:id')
  .get(asyncWrapper(reqGetNoteDetails, 200))
  .put(asyncWrapper(reqUpdateNote, 200))
  .delete(controllers.removeOne)

export default router
