import mongoose, { Schema, Types } from 'mongoose'

// One run of a maintenance task, from the Maintenance page or the CLI.
// The row is written when the run starts and kept up to date while it
// runs (#376), so a restart leaves a visible interrupted run, not nothing:
//
//   running      in progress; heartbeatAt advances every few seconds
//   done/failed  finished, with ok true/false
//   interrupted  its heartbeat stopped: the process ended mid-run
export type RunStatus = 'running' | 'done' | 'failed' | 'interrupted'
export const RUN_STATUSES: RunStatus[] = ['running', 'done', 'failed', 'interrupted']

export interface MaintenanceRunDoc {
  _id: Types.ObjectId
  taskId: string
  dryRun: boolean
  status?: RunStatus
  ok?: boolean
  output: string[]
  startedAt: Date
  heartbeatAt?: Date
  finishedAt?: Date
}

const maintenanceRunSchema = new Schema<MaintenanceRunDoc>({
  taskId: { type: String, required: true },
  dryRun: { type: Boolean, required: true },
  status: { type: String, enum: RUN_STATUSES },
  ok: Boolean,
  output: [String],
  startedAt: Date,
  heartbeatAt: Date,
  finishedAt: Date,
})

maintenanceRunSchema.index({ taskId: 1, finishedAt: -1 })
// At most one running run per task, across restarts and processes
maintenanceRunSchema.index({ taskId: 1 }, { unique: true, partialFilterExpression: { status: 'running' } })

export default mongoose.model<MaintenanceRunDoc>('maintenanceRun', maintenanceRunSchema)
