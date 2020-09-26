import { Router } from 'express'
import controllers, {
  reqGetNotesForPile,
  reqGetWorksForPile
} from './pile.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.autocompleteOnName)
router.route('/').post(controllers.createOne)

router.route('/:id/notes').get(reqGetNotesForPile)
router.route('/:id/works').get(reqGetWorksForPile)

router
  .route('/:id')
  .get(controllers.getOne)
  .delete(controllers.removeOne)

export default router
