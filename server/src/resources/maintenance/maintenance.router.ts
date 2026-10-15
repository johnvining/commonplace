import { Router } from 'express'
import { reqGetJob, reqListTasks, reqStartTask } from './maintenance.controllers.js'
import { asyncWrapper } from '../../utils/requests.js'

const router = Router()

router.route('/').get(asyncWrapper(reqListTasks, 200))
// Body { dryRun: false } for a real run; anything else is a dry run.
router.route('/:id/run').post(asyncWrapper(reqStartTask, 202))
router.route('/jobs/:jobId').get(asyncWrapper(reqGetJob, 200))

export default router
