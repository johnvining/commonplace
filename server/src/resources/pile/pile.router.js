import { Router } from 'express'
import controllers, {
  reqCreatePile,
  reqDeletePile,
  reqGetAutoComplete,
  reqGetAutoCompleteWithCounts,
  reqGetNotesForPile,
  reqGetWorksForPile
} from './pile.controllers'

const router = Router()

router.route('/autocomplete/with-counts').post(reqGetAutoCompleteWithCounts)
router.route('/autocomplete').post(reqGetAutoComplete)
router.route('/').post(reqCreatePile)

router.route('/:id/notes').get(reqGetNotesForPile)
router.route('/:id/works').get(reqGetWorksForPile)

router
  .route('/:id')
  .get(controllers.getOne)
  .delete(reqDeletePile)

export default router
