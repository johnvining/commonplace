import type { Request, Response } from 'express'
import MaintenanceRun from './maintenance.model.js'
import { TASKS } from './tasks.js'
import { getJob, startJob, statusOf } from './jobs.js'

// Tasks in run order, each with its last real (non-dry) run, if any.
// A task is pending until a real run has finished successfully; a run
// that's going, failed or was interrupted leaves it pending (#376).
export const reqListTasks = async (req: Request, res: Response) => {
  const lastRuns = await MaintenanceRun.aggregate([
    { $match: { dryRun: false } },
    { $sort: { startedAt: -1 } },
    { $group: { _id: '$taskId', run: { $first: '$$ROOT' } } },
  ])
  const byTask = Object.fromEntries(lastRuns.map((r) => [r._id, r.run]))
  return TASKS.map(({ id, title, issue, description }) => {
    const last = byTask[id]
    const status = last ? statusOf(last) : null
    return {
      id,
      title,
      issue,
      description,
      lastRun: last
        ? { status, ok: status === 'done', startedAt: last.startedAt, finishedAt: last.finishedAt ?? null, output: last.output }
        : null,
      pending: status !== 'done',
    }
  })
}

export const reqStartTask = async (req: Request, res: Response) => {
  const job = await startJob(String(req.params.id), req.body?.dryRun !== false)
  return { jobId: job.id }
}

export const reqGetJob = async (req: Request, res: Response) => {
  const job = await getJob(String(req.params.jobId))
  if (!job) return res.status(404).json({ message: 'Job not found' })
  return job
}
