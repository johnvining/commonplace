import { Router } from 'express'
import {
  reqClearRunningTimer,
  reqCreateTimeEntry,
  reqDeleteTimeEntry,
  reqGetRunningTimer,
  reqGetTimeEntry,
  reqGetTimeSummary,
  reqImportTimeEntries,
  reqListTimeEntries,
  reqRecentSubjects,
  reqSetRunningTimer,
  reqUpdateTimeEntry,
} from './time.controllers'
import { asyncWrapper } from '../../utils/requests.js'
import { requireObjectIdParam } from '../../utils/validateObjectId.js'

const router = Router()

// Named routes before /:id so 'summary' etc. aren't read as entry ids.
router.route('/summary').get(asyncWrapper(reqGetTimeSummary, 200))
router.route('/recent-subjects').get(asyncWrapper(reqRecentSubjects, 200))
router
  .route('/timer')
  .get(asyncWrapper(reqGetRunningTimer, 200))
  .put(asyncWrapper(reqSetRunningTimer, 200))
  .delete(asyncWrapper(reqClearRunningTimer, 200))
router.route('/import').post(asyncWrapper(reqImportTimeEntries, 201))
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
