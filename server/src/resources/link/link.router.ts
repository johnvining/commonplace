import { Router } from 'express'
import { reqLinkNoteToNote, reqGetLinksForNote } from './link.controllers'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/').put(asyncWrapper(reqLinkNoteToNote, 200)) // TODO: check codes
router.route('/note/:id').get(asyncWrapper(reqGetLinksForNote, 200)) // TODO: check codes
export default router
