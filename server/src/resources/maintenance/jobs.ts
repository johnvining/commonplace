import crypto from 'crypto'
import MaintenanceRun from './maintenance.model.js'
import { findTask } from './tasks.js'

export interface Job {
  id: string
  taskId: string
  dryRun: boolean
  status: 'running' | 'done' | 'failed'
  output: string[]
  startedAt: Date
  finishedAt?: Date
}

// Jobs run in the background so a long task (the OCR backlog) isn't cut
// off by a request timeout; the page polls getJob. Kept in memory: a
// restart loses unfinished jobs, but finished runs are saved.
const jobs = new Map<string, Job>()

export class TaskBusyError extends Error {
  status = 409
}

// Run a task to completion, recording the run. Used directly by the CLI.
export async function runTask(taskId: string, dryRun: boolean, job?: Job) {
  const task = findTask(taskId)
  if (!task) throw Object.assign(new Error(`Unknown task ${taskId}`), { status: 404 })
  const output = job?.output ?? []
  const log = (line: string) => {
    output.push(line)
    if (!job) console.log(line)
  }
  const startedAt = job?.startedAt ?? new Date()
  let ok = true
  try {
    await task.run({ dryRun, log })
  } catch (e) {
    ok = false
    log(`Error: ${e instanceof Error ? e.message : String(e)}`)
  }
  await MaintenanceRun.create({ taskId, dryRun, ok, output, startedAt, finishedAt: new Date() })
  return ok
}

export function startJob(taskId: string, dryRun: boolean): Job {
  if (!findTask(taskId)) throw Object.assign(new Error(`Unknown task ${taskId}`), { status: 404 })
  for (const j of jobs.values()) {
    if (j.taskId === taskId && j.status === 'running') {
      throw new TaskBusyError('This task is already running')
    }
  }
  const job: Job = {
    id: crypto.randomUUID(),
    taskId,
    dryRun,
    status: 'running',
    output: [],
    startedAt: new Date(),
  }
  jobs.set(job.id, job)
  runTask(taskId, dryRun, job)
    .then((ok) => { job.status = ok ? 'done' : 'failed' })
    .catch((e) => {
      job.status = 'failed'
      job.output.push(`Error: ${e instanceof Error ? e.message : String(e)}`)
    })
    .finally(() => { job.finishedAt = new Date() })
  return job
}

export const getJob = (id: string) => jobs.get(id)
