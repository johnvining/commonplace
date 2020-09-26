import { Router } from 'express'
import controllers from './pile.controllers'

const router = Router()

router.route('/autocomplete').post(controllers.autocompleteOnName)
router.route('/').post(controllers.createOne)

router
  .route('/:id')
  .get(controllers.getOne)
  .delete(controllers.removeOne)

export default router
