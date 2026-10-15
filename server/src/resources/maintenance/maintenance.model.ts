import mongoose, { Schema, Types } from 'mongoose'

// One run of a maintenance task, from the Maintenance page or the CLI.
export interface MaintenanceRunDoc {
  _id: Types.ObjectId
  taskId: string
  dryRun: boolean
  ok: boolean
  output: string[]
  startedAt: Date
  finishedAt: Date
}

const maintenanceRunSchema = new Schema<MaintenanceRunDoc>({
  taskId: { type: String, required: true },
  dryRun: { type: Boolean, required: true },
  ok: { type: Boolean, required: true },
  output: [String],
  startedAt: Date,
  finishedAt: Date,
})

maintenanceRunSchema.index({ taskId: 1, finishedAt: -1 })

export default mongoose.model<MaintenanceRunDoc>('maintenanceRun', maintenanceRunSchema)
