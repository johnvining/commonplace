import { Router } from 'express'
import controllers, {
  reqGetNotesForPile,
  reqGetWorksForPile,
  reqGetAutoCompleteWithCounts,
  reqGetAutoComplete
} from './pile.controllers'

const router = Router()

router.route('/autocomplete/with-counts').post(reqGetAutoCompleteWithCounts)
router.route('/autocomplete').post(reqGetAutoComplete)
router.route('/').post(controllers.createOne)

router.route('/:id/notes').get(reqGetNotesForPile)
router.route('/:id/works').get(reqGetWorksForPile)

router
  .route('/:id')
  .get(controllers.getOne)
  .delete(controllers.removeOne)

export default router
