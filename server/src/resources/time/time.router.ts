import { Router } from 'express'
import {
  reqCreateTimeEntry,
  reqDeleteTimeEntry,
  reqGetTimeEntry,
  reqGetTimeSummary,
  reqListTimeEntries,
  reqUpdateTimeEntry,
} from './time.controllers'
import { asyncWrapper } from '../../utils/requests.js'
import { requireObjectIdParam } from '../../utils/validateObjectId.js'

const router = Router()

// /summary before /:id so 'summary' isn't read as an entry id.
router.route('/summary').get(asyncWrapper(reqGetTimeSummary, 200))
router
  .route('/')
  .post(asyncWrapper(reqCreateTimeEntry, 201))
  .get(asyncWrapper(reqListTimeEntries, 200))

router
  .route('/:id')
  .get(requireObjectIdParam('id'), asyncWrapper(reqGetTimeEntry, 200))
  .put(requireObjectIdParam('id'), asyncWrapper(reqUpdateTimeEntry, 200))
  .delete(requireObjectIdParam('id'), asyncWrapper(reqDeleteTimeEntry, 204))

export default router
