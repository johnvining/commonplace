import type { Request, Response } from 'express'
import MaintenanceRun from './maintenance.model.js'
import { TASKS } from './tasks.js'
import { getJob, startJob } from './jobs.js'

// Tasks in run order, each with its last real (non-dry) run, if any.
// A task is pending until a real run has succeeded.
export const reqListTasks = async (req: Request, res: Response) => {
  const lastRuns = await MaintenanceRun.aggregate([
    { $match: { dryRun: false } },
    { $sort: { finishedAt: -1 } },
    { $group: { _id: '$taskId', run: { $first: '$$ROOT' } } },
  ])
  const byTask = Object.fromEntries(lastRuns.map((r) => [r._id, r.run]))
  return TASKS.map(({ id, title, issue, description }) => {
    const last = byTask[id]
    return {
      id,
      title,
      issue,
      description,
      lastRun: last ? { ok: last.ok, finishedAt: last.finishedAt, output: last.output } : null,
      pending: !last?.ok,
    }
  })
}

export const reqStartTask = async (req: Request, res: Response) => {
  const job = startJob(String(req.params.id), req.body?.dryRun !== false)
  return { jobId: job.id }
}

export const reqGetJob = async (req: Request, res: Response) => {
  const job = getJob(String(req.params.jobId))
  if (!job) return res.status(404).json({ message: 'Job not found (the server may have restarted)' })
  return job
}
