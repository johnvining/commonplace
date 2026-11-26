import mongoose, { Schema, Types } from 'mongoose'

export const TIME_KINDS = ['reading', 'writing'] as const
export type TimeKind = (typeof TIME_KINDS)[number]

export interface TimeEntryDoc {
  _id: Types.ObjectId
  title?: string
  pile?: Types.ObjectId
  /** The work being read/written, when the time is tied to one. */
  work?: Types.ObjectId | null
  kind: TimeKind
  minutes: number
  date: Date
  /** Actual session start/end when captured by a timer (manual entries
   * leave these unset). Stored as instants for later analytics. */
  startedAt?: Date | null
  endedAt?: Date | null
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// One time-log entry: minutes spent reading or writing on a given day,
// labelled with a free-text title, a link to a pile (a piece being
// written/researched), or both. Titles keep one-off sessions describable;
// piles let a piece accumulate reading vs writing time across days.
const timeEntrySchema = new Schema<TimeEntryDoc>(
  {
    title: { type: String, trim: true, default: '' },
    pile: { type: Schema.Types.ObjectId, ref: 'pile' },
    work: { type: Schema.Types.ObjectId, ref: 'work', default: null },
    kind: { type: String, enum: TIME_KINDS, required: true },
    minutes: { type: Number, required: true, min: 1, max: 1440 },
    // The day the work happened, normalized to UTC midnight.
    date: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
)

timeEntrySchema.index({ date: -1 })
timeEntrySchema.index({ pile: 1 })
timeEntrySchema.index({ work: 1 })
timeEntrySchema.index({ kind: 1 })

export default mongoose.model<TimeEntryDoc>('timeentry', timeEntrySchema)
