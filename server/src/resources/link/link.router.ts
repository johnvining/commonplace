import { Router } from 'express'
import { reqLinkNoteToNote, reqGetLinksForNote, reqDeleteLink, reqDeleteLinkBetween } from './link.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/').put(asyncWrapper(reqLinkNoteToNote, 200)) // TODO: check codes
router.route('/note/:id').get(asyncWrapper(reqGetLinksForNote, 200)) // TODO: check codes
router.route('/between/:a/:b').delete(asyncWrapper(reqDeleteLinkBetween, 200))
router.route('/:id').delete(asyncWrapper(reqDeleteLink, 200))
export default router
