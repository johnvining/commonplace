import MaintenanceRun, { type MaintenanceRunDoc, type RunStatus } from './maintenance.model.js'
import { findTask } from './tasks.js'

// What the Maintenance page polls: a run, by id
export interface Job {
  id: string
  taskId: string
  dryRun: boolean
  status: RunStatus
  output: string[]
  startedAt: Date
  finishedAt?: Date
}

// A running run's row is refreshed this often; one silent for STALE_MS
// belongs to a process that stopped, and counts as interrupted (#376)
const HEARTBEAT_MS = 5_000
const STALE_MS = 60_000

export class TaskBusyError extends Error {
  status = 409
}

// Live output of runs in this process, so polling sees every line at once
const live = new Map<string, Job>()

// The one place a run's status is read. Rows saved before status existed
// read from ok; a running row whose heartbeat stopped is interrupted.
export function statusOf(run: Pick<MaintenanceRunDoc, 'status' | 'ok' | 'heartbeatAt' | 'startedAt'>, now = Date.now()): RunStatus {
  if (run.status === 'running') {
    const beat = new Date(run.heartbeatAt ?? run.startedAt).getTime()
    return now - beat > STALE_MS ? 'interrupted' : 'running'
  }
  if (run.status) return run.status
  return run.ok ? 'done' : 'failed'
}

// Record interrupted runs as such, so the one-running guard frees up
async function settleStaleRuns() {
  await MaintenanceRun.updateMany(
    { status: 'running', $or: [{ heartbeatAt: { $lt: new Date(Date.now() - STALE_MS) } }, { heartbeatAt: { $exists: false } }] },
    { $set: { status: 'interrupted', ok: false } }
  )
}

// Create the run's row, refusing if the task is already running anywhere
async function beginRun(taskId: string, dryRun: boolean) {
  if (!findTask(taskId)) throw Object.assign(new Error(`Unknown task ${taskId}`), { status: 404 })
  await settleStaleRuns()
  const now = new Date()
  try {
    return await MaintenanceRun.create({ taskId, dryRun, status: 'running', output: [], startedAt: now, heartbeatAt: now })
  } catch (e: any) {
    if (e?.code === 11000) throw new TaskBusyError('This task is already running')
    throw e
  }
}

// Run a task to completion on an existing row, saving its output as it
// goes and its result at the end
async function finishRun(run: InstanceType<typeof MaintenanceRun>, job: Job, echo: boolean) {
  const task = findTask(job.taskId)!
  let dirty = false
  const log = (line: string) => {
    job.output.push(line)
    dirty = true
    if (echo) console.log(line)
  }
  const beat = setInterval(() => {
    MaintenanceRun.updateOne(
      { _id: run._id },
      { $set: { heartbeatAt: new Date(), ...(dirty ? { output: job.output } : {}) } }
    ).catch((e) => console.error('[maintenance] heartbeat failed', e))
    dirty = false
  }, HEARTBEAT_MS)
  beat.unref?.()
  let ok = true
  try {
    await task.run({ dryRun: job.dryRun, log })
  } catch (e) {
    ok = false
    log(`Error: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    clearInterval(beat)
  }
  job.status = ok ? 'done' : 'failed'
  job.finishedAt = new Date()
  await MaintenanceRun.updateOne(
    { _id: run._id },
    { $set: { status: job.status, ok, output: job.output, finishedAt: job.finishedAt, heartbeatAt: job.finishedAt } }
  )
  return ok
}

const jobFor = (run: MaintenanceRunDoc): Job => ({
  id: String(run._id),
  taskId: run.taskId,
  dryRun: run.dryRun,
  status: statusOf(run),
  output: run.output ?? [],
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
})

// Run a task to completion in this process. Used directly by the CLI.
export async function runTask(taskId: string, dryRun: boolean) {
  const run = await beginRun(taskId, dryRun)
  return finishRun(run, jobFor(run.toObject()), true)
}

// Start a task in the background, for the Maintenance page to poll
export async function startJob(taskId: string, dryRun: boolean): Promise<Job> {
  const run = await beginRun(taskId, dryRun)
  const job = jobFor(run.toObject())
  live.set(job.id, job)
  finishRun(run, job, false)
    .catch((e) => {
      job.status = 'failed'
      job.output.push(`Error: ${e instanceof Error ? e.message : String(e)}`)
    })
    .finally(() => setTimeout(() => live.delete(job.id), 10 * 60 * 1000).unref?.())
  return job
}

// A run by id: live from this process, or as saved
export async function getJob(id: string): Promise<Job | null> {
  const running = live.get(id)
  if (running) return running
  if (!/^[0-9a-f]{24}$/.test(id)) return null
  const run = await MaintenanceRun.findById(id).lean()
  return run ? jobFor(run) : null
}
